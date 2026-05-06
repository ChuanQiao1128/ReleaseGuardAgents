import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addEdge,
  addFileNode,
  makeEdge,
  toRepoRelativePath,
} from "../graph/capabilityGraph";
import { CapabilityGraph } from "../graph/types";
import { ApiScanResult } from "./nextApiScanner";
import { RouteScanResult } from "./nextRouteScanner";
import { lineForIndex, lineQuote, pathExists } from "./fileUtils";
import { ScannerCoverage, UnresolvedCallsite } from "./types";

type FetchLiteralMatch = {
  url: string;
  method: string;
  index: number;
};

type RouteContext = {
  route: RouteScanResult;
  files: Set<string>;
};

export async function scanFetchLiterals(
  rootDir: string,
  graph: CapabilityGraph,
  routes: RouteScanResult[],
  apis: ApiScanResult[],
  coverage: ScannerCoverage,
): Promise<void> {
  const contexts = await buildRouteContexts(routes);
  const apiByTarget = new Map(
    apis.map((api) => [`${api.method} ${api.path}`, api] as const),
  );

  for (const context of contexts) {
    for (const absoluteFile of context.files) {
      const relativePath = toRepoRelativePath(rootDir, absoluteFile);
      addFileNode(graph, rootDir, absoluteFile, "frontend_file_scanned");
      const source = await fs.readFile(absoluteFile, "utf8");
      const resolved = findDirectFetchLiterals(source);
      const resolvedIndexes = new Set(resolved.map((match) => match.index));

      for (const match of resolved) {
        const api = apiByTarget.get(`${match.method} ${match.url}`);
        if (!api) {
          coverage.unresolvedCallsites.push({
            filePath: relativePath,
            line: lineForIndex(source, match.index),
            reason: `No scanned API matched ${match.method} ${match.url}.`,
            quote: lineQuote(source, lineForIndex(source, match.index)),
            confidence: "unresolved",
          });
          continue;
        }

        const line = lineForIndex(source, match.index);
        const edge = makeEdge(
          context.route.routeNode.id,
          "consumes",
          api.apiNode.id,
          "high",
          "direct_fetch_literal",
          [
            {
              filePath: relativePath,
              lineStart: line,
              lineEnd: line,
              quote: lineQuote(source, line),
              reason: "Direct fetch literal connects route UI to API.",
            },
          ],
          { method: match.method, path: match.url },
        );
        addEdge(graph, edge);
        coverage.resolvedCallsites.push({
          filePath: relativePath,
          line,
          routeId: context.route.routeNode.id,
          apiId: api.apiNode.id,
          method: match.method,
          path: match.url,
          confidence: "high",
          confidenceBasis: "direct_fetch_literal",
        });
      }

      for (const unresolved of findUnsupportedFetches(
        source,
        relativePath,
        resolvedIndexes,
      )) {
        coverage.unresolvedCallsites.push(unresolved);
      }
    }
  }
}

export function findDirectFetchLiterals(source: string): FetchLiteralMatch[] {
  const matches: FetchLiteralMatch[] = [];
  const fetchLiteralRegex = /fetch\s*\(\s*(["'])(\/api\/[^"']+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = fetchLiteralRegex.exec(source))) {
    const window = source.slice(match.index, match.index + 400);
    const methodMatch = /method\s*:\s*(["'])([A-Za-z]+)\1/.exec(window);
    matches.push({
      url: match[2],
      method: methodMatch?.[2]?.toUpperCase() ?? "GET",
      index: match.index,
    });
  }
  return matches;
}

export function findUnsupportedFetches(
  source: string,
  filePath: string,
  resolvedIndexes: Set<number> = new Set(),
): UnresolvedCallsite[] {
  const unresolved: UnresolvedCallsite[] = [];
  const fetchRegex = /fetch\s*\(\s*([^,\)\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = fetchRegex.exec(source))) {
    if (resolvedIndexes.has(match.index)) {
      continue;
    }
    const firstArg = match[1].trim();
    if (/^["']\/api\/[^"']+["']$/.test(firstArg)) {
      continue;
    }
    unresolved.push({
      filePath,
      line: lineForIndex(source, match.index),
      reason:
        "Unsupported fetch call in v0.1. Only direct string literals like fetch(\"/api/...\") are resolved.",
      quote: lineQuote(source, lineForIndex(source, match.index)),
      confidence: "unresolved",
    });
  }
  return unresolved;
}

async function buildRouteContexts(
  routes: RouteScanResult[],
): Promise<RouteContext[]> {
  const contexts: RouteContext[] = [];
  for (const route of routes) {
    const files = new Set<string>();
    await collectLocalImports(route.absolutePath, files);
    contexts.push({ route, files });
  }
  return contexts;
}

async function collectLocalImports(
  absoluteFile: string,
  files: Set<string>,
): Promise<void> {
  if (files.has(absoluteFile)) {
    return;
  }
  files.add(absoluteFile);
  const source = await fs.readFile(absoluteFile, "utf8");
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source))) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) {
      continue;
    }
    const resolved = await resolveLocalImport(path.dirname(absoluteFile), specifier);
    if (resolved) {
      await collectLocalImports(resolved, files);
    }
  }
}

async function resolveLocalImport(
  baseDir: string,
  specifier: string,
): Promise<string | undefined> {
  const base = path.resolve(baseDir, specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

