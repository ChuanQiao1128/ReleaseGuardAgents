import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addEdge,
  addFileNode,
  addNode,
  apiNodeId,
  defineEdge,
  toRepoRelativePath,
} from "../graph/capabilityGraph";
import { CapabilityGraph, CapabilityNode } from "../graph/types";
import { lineForIndex, lineQuote, listFiles } from "./fileUtils";
import { ScannerCoverage, UnresolvedCallsite } from "./types";
import { classifyUnresolvedPattern } from "./unresolvedPatternClassifier";

export type AxiosCallsiteMatch = {
  url: string;
  method: string;
  index: number;
  basis: string;
};

/**
 * Common conventions for axios client variable names. Recognized even when
 * we can't see the `axios.create(...)` assignment (e.g. when the import is
 * cross-file and we are scanning files individually). Conservative — must
 * not match unrelated identifiers like `console`, `window`, `fetch`, etc.
 *
 * `http` is the most common in real-world Vite + React projects (e.g. it's
 * the default in axios docs, react-query examples, Anthropic-internal
 * recall projects, etc).
 */
const WELL_KNOWN_CLIENT_NAMES = new Set([
  "http",
  "api",
  "client",
  "request",
  "instance",
  "httpClient",
  "axiosInstance",
]);

/**
 * Scan all .ts/.tsx files under `src/` for outbound HTTP API callsites.
 *
 * Two-pass design:
 *   Pass 1: scan every file for `const NAME = axios.create(...)` and
 *           `export const NAME = axios.create(...)` assignments. This
 *           lets the second pass recognize callsites like `http.get(...)`
 *           even when `http` is imported from another file.
 *   Pass 2: for each file, find axios callsites using the union of
 *           well-known client names and the names discovered in pass 1.
 *
 * For Vite + React Router projects the API server typically lives in a
 * different repository, so we treat every detected callsite as an
 * *outbound* API dependency.
 */
export async function scanAxiosCallsites(
  rootDir: string,
  appRoot: string,
  graph: CapabilityGraph,
  coverage: ScannerCoverage,
): Promise<void> {
  const srcDir = path.join(appRoot, "src");
  const sourceFiles = await listFiles(srcDir, (filePath) =>
    /\.(ts|tsx|js|jsx)$/.test(filePath),
  );

  // Pass 1: collect axios.create() variable names project-wide.
  const discoveredClientNames = new Set<string>();
  const fileSources = new Map<string, string>();
  for (const filePath of sourceFiles) {
    const source = await fs.readFile(filePath, "utf8");
    fileSources.set(filePath, source);
    for (const name of findAxiosCreateAssignments(source)) {
      discoveredClientNames.add(name);
    }
  }
  const knownClients = new Set([
    ...WELL_KNOWN_CLIENT_NAMES,
    ...discoveredClientNames,
  ]);

  // Pass 2: actually extract callsites and unresolved entries.
  for (const filePath of sourceFiles) {
    const relativePath = toRepoRelativePath(rootDir, filePath);
    const source = fileSources.get(filePath) ?? "";
    const matches = findAxiosCallsites(source, knownClients);
    const unresolved = findUnresolvedAxiosCallsites(
      source,
      relativePath,
      knownClients,
    );

    if (matches.length === 0) {
      for (const callsite of unresolved) {
        coverage.unresolvedCallsites.push(callsite);
      }
      continue;
    }

    const fileNode = addFileNode(graph, rootDir, filePath, "vite_api_caller_file");

    for (const match of matches) {
      const id = apiNodeId(match.method, match.url);
      let apiNode = graph.nodes[id];
      if (!apiNode) {
        const target = `${match.method} ${match.url}`;
        apiNode = {
          id,
          type: "api",
          name: target,
          target,
          // Outbound APIs are not defined inside this repo, so we don't
          // attach a filePath. The decision engine uses filePath to map
          // diff entries to capabilities; outbound apis are reached via
          // their `defines` edges from caller files instead.
          risk: apiRisk(match.url),
          confidence: "medium",
          confidenceBasis: "vite_outbound_api",
          evidenceRefs: [
            {
              filePath: relativePath,
              lineStart: lineForIndex(source, match.index),
              lineEnd: lineForIndex(source, match.index),
              quote: lineQuote(source, lineForIndex(source, match.index)),
              reason:
                "Outbound API callsite detected via axios in a Vite + React Router app.",
            },
          ],
          metadata: {
            framework: "vite_react_router",
            outbound: true,
          },
        };
        addNode(graph, apiNode);
        coverage.detectedApis.push({
          id,
          target,
          filePath: relativePath,
        });
      }

      const line = lineForIndex(source, match.index);
      addEdge(
        graph,
        defineEdge(
          fileNode.id,
          id,
          [
            {
              filePath: relativePath,
              lineStart: line,
              lineEnd: line,
              quote: lineQuote(source, line),
              reason: `${match.basis} declares an outbound API dependency.`,
            },
          ],
          match.basis,
        ),
      );
      coverage.resolvedCallsites.push({
        filePath: relativePath,
        line,
        routeId: fileNode.id,
        apiId: id,
        method: match.method,
        path: match.url,
        confidence: "medium",
        confidenceBasis: match.basis,
      });
    }

    for (const callsite of unresolved) {
      coverage.unresolvedCallsites.push(callsite);
    }
  }
}

/**
 * Find variable names that are assigned to an `axios.create(...)` call.
 *
 * Supported forms:
 *   const NAME = axios.create({ ... });
 *   export const NAME = axios.create({ ... });
 *   let NAME = axios.create({ ... });
 *
 * Returns names without quotes. Callers can use these as additional
 * "client identifier" patterns when scanning for `NAME.METHOD(...)`.
 */
export function findAxiosCreateAssignments(source: string): string[] {
  const names: string[] = [];
  const regex =
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*axios\s*\.\s*create\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Find axios callsites with a literal URL.
 *
 * Supported forms:
 *   axios.get("/path")          → method GET
 *   axios.post("/path", ...)    → method POST
 *   axios.put / .delete / .patch / .head / .options
 *   axios.request({ url: "/path", method: "POST" })
 *   axios("/path", { method: "POST" })
 *   <CLIENT>.METHOD("/path")    where CLIENT is a known wrapped client
 *                               (well-known names + names discovered via
 *                               findAxiosCreateAssignments)
 */
export function findAxiosCallsites(
  source: string,
  knownClientNames: Set<string> = WELL_KNOWN_CLIENT_NAMES,
): AxiosCallsiteMatch[] {
  const matches: AxiosCallsiteMatch[] = [];
  const seen = new Set<string>();

  // Always include in-file axios.create() assignments. The multi-file
  // pipeline (scanAxiosCallsites) adds cross-file names on top of this
  // via the knownClientNames argument; here we ensure single-file usage
  // still discovers locally-defined client names.
  const inFileNames = findAxiosCreateAssignments(source);
  const effectiveClientNames = new Set([
    ...knownClientNames,
    ...inFileNames,
  ]);

  const verbBase = "(get|post|put|patch|delete|head|options)";
  // Optional TypeScript generic between method and `(`. Allows up to two
  // levels of nested angle brackets (covers `<ApiResult<Deck[]>>` etc).
  // Non-capturing so it does not shift group indices.
  const optGeneric = "(?:<(?:[^<>]|<[^<>]*>)*>)?";

  // Direct axios.METHOD<T>?(literal)
  const directVerbRegex = new RegExp(
    `\\baxios\\s*\\.\\s*${verbBase}\\s*${optGeneric}\\s*\\(\\s*(["'\`])([^"'\`]+)\\2`,
    "g",
  );
  pushFromVerbRegex(source, directVerbRegex, matches, seen, "axios_method_literal");

  // Wrapped clients: any name in the union of well-known + discovered.
  if (effectiveClientNames.size > 0) {
    const namePattern = [...effectiveClientNames]
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
      .map(escapeRegExp)
      .join("|");
    if (namePattern.length > 0) {
      const wrappedRegex = new RegExp(
        `\\b(${namePattern})\\s*\\.\\s*${verbBase}\\s*${optGeneric}\\s*\\(\\s*(["'\`])([^"'\`]+)\\3`,
        "g",
      );
      pushFromVerbRegex(
        source,
        wrappedRegex,
        matches,
        seen,
        "axios_client_wrapper_literal",
        /* clientGroupShift */ true,
      );
    }
  }

  // axios<T>?("/path", { method: "..." })  or  axios("/path")
  const callableRegex = /\baxios\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(["'`])([^"'`]+)\1\s*(?:,\s*\{([^}]*)\})?/g;
  let match: RegExpExecArray | null;
  while ((match = callableRegex.exec(source))) {
    const url = match[2];
    if (containsTemplateInterpolation(url)) continue;
    const config = match[3] ?? "";
    const methodMatch = /method\s*:\s*(["'`])([A-Za-z]+)\1/.exec(config);
    const method = (methodMatch?.[2] ?? "GET").toUpperCase();
    addUnique(matches, seen, {
      url,
      method,
      index: match.index,
      basis: "axios_callable_literal",
    });
  }

  // axios.request({ url: "/path", method: "POST" })
  const requestRegex = /\baxios\s*\.\s*request\s*\(\s*\{([\s\S]{0,400}?)\}/g;
  while ((match = requestRegex.exec(source))) {
    const body = match[1];
    const urlMatch = /url\s*:\s*(["'`])([^"'`]+)\1/.exec(body);
    if (!urlMatch) continue;
    const url = urlMatch[2];
    if (containsTemplateInterpolation(url)) continue;
    const methodMatch = /method\s*:\s*(["'`])([A-Za-z]+)\1/.exec(body);
    addUnique(matches, seen, {
      url,
      method: (methodMatch?.[2] ?? "GET").toUpperCase(),
      index: match.index,
      basis: "axios_request_config_literal",
    });
  }

  return matches;
}

function pushFromVerbRegex(
  source: string,
  regex: RegExp,
  matches: AxiosCallsiteMatch[],
  seen: Set<string>,
  basis: string,
  clientGroupShift: boolean = false,
): void {
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source))) {
    // Group 1 is either the verb (no client) or the client name (with client).
    // When clientGroupShift is true, the verb is in group 2, url in group 4.
    // When false, verb is in group 1, url in group 3.
    const method = (clientGroupShift ? m[2] : m[1]).toUpperCase();
    const url = clientGroupShift ? m[4] : m[3];
    if (containsTemplateInterpolation(url)) {
      // Template literal with ${...} — URL is dynamic, not a static literal.
      // Skip; the unresolved scanner will pick it up.
      continue;
    }
    addUnique(matches, seen, {
      url,
      method,
      index: m.index,
      basis,
    });
  }
}

/**
 * Returns true if a string captured between matching ` `, ' ', or " "
 * delimiters contains `${...}` interpolation. Backtick template literals
 * with interpolation must NOT be treated as resolvable URLs because the
 * actual runtime value depends on a JavaScript expression.
 */
function containsTemplateInterpolation(value: string): boolean {
  return value.includes("${");
}

function addUnique(
  matches: AxiosCallsiteMatch[],
  seen: Set<string>,
  match: AxiosCallsiteMatch,
): void {
  const key = `${match.index}:${match.method}:${match.url}`;
  if (seen.has(key)) return;
  seen.add(key);
  matches.push(match);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find axios callsites whose URL we cannot resolve (template literals,
 * variables, or computed expressions). These are reported but do not
 * produce edges in the graph. Looks at both `axios.METHOD(...)` and
 * `<KNOWN_CLIENT>.METHOD(...)` forms.
 */
export function findUnresolvedAxiosCallsites(
  source: string,
  filePath: string,
  knownClientNames: Set<string> = WELL_KNOWN_CLIENT_NAMES,
): UnresolvedCallsite[] {
  const unresolved: UnresolvedCallsite[] = [];
  const seenIndices = new Set<number>();

  const verbBase = "(get|post|put|patch|delete|head|options)";
  const namePattern = [...knownClientNames]
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
    .map(escapeRegExp)
    .join("|");

  const callerPattern = namePattern.length > 0
    ? `(?:axios|${namePattern})`
    : "axios";

  const optGeneric = "(?:<(?:[^<>]|<[^<>]*>)*>)?";
  const verbCallRegex = new RegExp(
    `\\b${callerPattern}\\s*\\.\\s*${verbBase}\\s*${optGeneric}\\s*\\(\\s*([^,)\\n]+)`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = verbCallRegex.exec(source))) {
    if (seenIndices.has(match.index)) continue;
    seenIndices.add(match.index);
    const arg = match[2].trim();
    // Plain string literals (single/double quotes) — already resolved.
    if (/^["'][^"']+["']$/.test(arg)) {
      continue;
    }
    // Template literals WITHOUT interpolation are treated as resolved.
    // Template literals WITH `${...}` interpolation must fall through.
    if (/^`[^`$]*`$/.test(arg)) {
      continue;
    }
    if (/^\{/.test(arg)) {
      continue; // axios.method({...}) form — handled separately
    }
    const callsite: UnresolvedCallsite = {
      filePath,
      line: lineForIndex(source, match.index),
      reason:
        "Axios call with a non-literal URL; only string literal URLs are resolved.",
      quote: lineQuote(source, lineForIndex(source, match.index)),
      confidence: "unresolved",
    };
    unresolved.push({
      ...callsite,
      pattern: classifyUnresolvedPattern(callsite),
    });
  }
  return unresolved;
}

function apiRisk(url: string): "low" | "medium" | "high" {
  // Conservative defaults; the RAG layer can elevate risk through trusted
  // historical context. Scanner only sets a baseline.
  const critical = ["checkout", "billing", "payment", "discount", "auth"];
  if (critical.some((tag) => url.toLowerCase().includes(tag))) {
    return "high";
  }
  return "medium";
}
