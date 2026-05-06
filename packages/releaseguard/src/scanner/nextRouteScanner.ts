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
import { listFiles } from "./fileUtils";
import { ScannerCoverage } from "./types";

export type RouteScanResult = {
  routeNode: CapabilityNode;
  fileNodeId: string;
  absolutePath: string;
  relativePath: string;
};

export async function scanNextRoutes(
  rootDir: string,
  appDir: string,
  graph: CapabilityGraph,
  coverage: ScannerCoverage,
): Promise<RouteScanResult[]> {
  const pageFiles = await listFiles(
    appDir,
    (filePath) =>
      filePath.endsWith("page.tsx") && !filePath.includes(`${path.sep}api${path.sep}`),
  );
  const routes: RouteScanResult[] = [];

  for (const pageFile of pageFiles) {
    const relativePath = toRepoRelativePath(rootDir, pageFile);
    const routePath = routePathFromPage(appDir, pageFile);
    const fileNode = addFileNode(graph, rootDir, pageFile, "nextjs_page_file");
    const source = await fs.readFile(pageFile, "utf8");
    const routeNode: CapabilityNode = {
      id: routeNodeId(routePath),
      type: "route",
      name: routePath,
      target: routePath,
      filePath: relativePath,
      risk: routePath === "/checkout" ? "high" : "medium",
      confidence: "high",
      confidenceBasis: "nextjs_file_route",
      evidenceRefs: [
        {
          filePath: relativePath,
          lineStart: 1,
          lineEnd: Math.min(source.split(/\r?\n/).length, 1),
          quote: "page.tsx",
          reason: "Next.js App Router page file maps to a route.",
        },
      ],
      metadata: {},
    };
    addNode(graph, routeNode);
    addEdge(
      graph,
      defineEdge(
        fileNode.id,
        routeNode.id,
        routeNode.evidenceRefs,
        "nextjs_file_route",
      ),
    );
    coverage.detectedRoutes.push({
      id: routeNode.id,
      target: routePath,
      filePath: relativePath,
    });
    routes.push({
      routeNode,
      fileNodeId: fileNode.id,
      absolutePath: pageFile,
      relativePath,
    });
  }

  return routes;
}

function routePathFromPage(appDir: string, pageFile: string): string {
  const relative = path.relative(appDir, path.dirname(pageFile));
  if (!relative) {
    return "/";
  }
  const segments = relative
    .split(path.sep)
    .filter((segment) => segment && !segment.startsWith("("));
  return `/${segments.join("/")}`;
}

