import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addEdge,
  addFileNode,
  addNode,
  defineEdge,
  routeNodeId,
  toRepoRelativePath,
} from "../graph/capabilityGraph";
import { CapabilityGraph, CapabilityNode } from "../graph/types";
import { lineForIndex, lineQuote, listFiles } from "./fileUtils";
import { ScannerCoverage } from "./types";

export type ViteRouteScanResult = {
  routeNode: CapabilityNode;
  fileNodeId: string;
  absolutePath: string;
  relativePath: string;
  routePath: string;
};

type RouteMatch = {
  path: string;
  index: number;
  basis: string;
};

export async function scanViteReactRouterRoutes(
  rootDir: string,
  appRoot: string,
  graph: CapabilityGraph,
  coverage: ScannerCoverage,
): Promise<ViteRouteScanResult[]> {
  const srcDir = path.join(appRoot, "src");
  const sourceFiles = await listFiles(srcDir, (filePath) =>
    /\.(tsx|jsx)$/.test(filePath),
  );

  const results: ViteRouteScanResult[] = [];
  const seenRouteIds = new Set<string>();

  for (const filePath of sourceFiles) {
    const relativePath = toRepoRelativePath(rootDir, filePath);
    const source = await fs.readFile(filePath, "utf8");
    const matches = findReactRouterRoutes(source);
    if (matches.length === 0) {
      continue;
    }

    const fileNode = addFileNode(graph, rootDir, filePath, "vite_route_file");

    for (const match of matches) {
      const id = routeNodeId(match.path);
      if (seenRouteIds.has(id)) {
        // Don't double-create the same logical route across files.
        continue;
      }
      seenRouteIds.add(id);
      const line = lineForIndex(source, match.index);
      const routeNode: CapabilityNode = {
        id,
        type: "route",
        name: match.path,
        target: match.path,
        filePath: relativePath,
        risk: routeRisk(match.path),
        confidence: "medium",
        confidenceBasis: match.basis,
        evidenceRefs: [
          {
            filePath: relativePath,
            lineStart: line,
            lineEnd: line,
            quote: lineQuote(source, line),
            reason:
              "React Router route declaration maps to a user-facing route.",
          },
        ],
        metadata: { framework: "vite_react_router" },
      };
      addNode(graph, routeNode);
      addEdge(
        graph,
        defineEdge(
          fileNode.id,
          routeNode.id,
          routeNode.evidenceRefs,
          match.basis,
        ),
      );
      coverage.detectedRoutes.push({
        id: routeNode.id,
        target: match.path,
        filePath: relativePath,
      });
      results.push({
        routeNode,
        fileNodeId: fileNode.id,
        absolutePath: filePath,
        relativePath,
        routePath: match.path,
      });
    }
  }

  return results;
}

/**
 * Find React Router route declarations in a source file.
 *
 * Currently supports:
 *   - JSX:   <Route path="/foo" ... />
 *   - Data:  createBrowserRouter([{ path: "/foo", ... }, ...])
 *   - Hook:  useRoutes([{ path: "/foo", ... }, ...])
 *
 * Limitations (v1):
 *   - Path values that are template literals, identifiers, or computed
 *     expressions are skipped — only string literal paths are accepted.
 *   - Nested children are followed as long as their own `path` is a string
 *     literal; relative children are emitted as their literal path (not
 *     joined with their parent), because joining requires AST-level
 *     scope tracking.
 */
export function findReactRouterRoutes(source: string): RouteMatch[] {
  const matches: RouteMatch[] = [];
  const seen = new Set<number>();

  // 1. JSX <Route path="...">  (also matches self-closing <Route path="..." />)
  const jsxRouteRegex = /<Route\b[^>]*?\bpath\s*=\s*(["'])([^"']*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = jsxRouteRegex.exec(source))) {
    if (seen.has(match.index)) continue;
    seen.add(match.index);
    matches.push({
      path: normalizeRoutePath(match[2]),
      index: match.index,
      basis: "react_router_jsx_route",
    });
  }

  // 2. Object-form `path: "..."` inside createBrowserRouter / useRoutes /
  //    createMemoryRouter / createHashRouter / RouteObject arrays.
  //
  //    We don't try to AST-parse the array. Instead we only accept object
  //    `path` entries that appear within a few hundred characters after one
  //    of the supported router constructors. This avoids matching unrelated
  //    `path: "..."` properties elsewhere in the file (e.g. file system
  //    paths in a config object).
  const constructorRegex =
    /\b(createBrowserRouter|createMemoryRouter|createHashRouter|useRoutes)\s*\(/g;
  while ((match = constructorRegex.exec(source))) {
    const start = match.index + match[0].length;
    const window = extractBalancedWindow(source, start);
    if (!window) continue;
    const pathRegex = /(?<!\w)path\s*:\s*(["'])([^"']*)\1/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRegex.exec(window.text))) {
      const absoluteIndex = start + pathMatch.index;
      if (seen.has(absoluteIndex)) continue;
      seen.add(absoluteIndex);
      matches.push({
        path: normalizeRoutePath(pathMatch[2]),
        index: absoluteIndex,
        basis: "react_router_object_route",
      });
    }
  }

  return matches;
}

/**
 * From an opening parenthesis position, walk forward and return the slice up
 * to the matching closing parenthesis. Returns undefined if unbalanced.
 *
 * String literals and template literals are respected so that `(` / `)`
 * inside strings does not affect the depth counter.
 */
function extractBalancedWindow(
  source: string,
  start: number,
): { text: string; end: number } | undefined {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === "`") inTemplate = false;
      continue;
    }
    if (ch === "/" && next === "/") { inLineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i += 1; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === "`") { inTemplate = true; continue; }
    if (ch === "(") { depth += 1; continue; }
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        return { text: source.slice(start, i), end: i };
      }
    }
  }
  return undefined;
}

function normalizeRoutePath(value: string): string {
  if (!value) return "/";
  if (value === "*") return "/*";
  if (value.startsWith("/")) return value;
  // Relative children paths are kept as-is (with a leading slash for
  // graph id stability), but flagged for future improvement.
  return `/${value}`;
}

function routeRisk(routePath: string): "low" | "medium" | "high" {
  // Conservative defaults. The decision engine and RAG layer can elevate
  // risk through historical context; the scanner only sets a baseline.
  const critical = ["/checkout", "/billing", "/payment", "/admin"];
  if (critical.some((p) => routePath === p || routePath.startsWith(`${p}/`))) {
    return "high";
  }
  return "medium";
}
