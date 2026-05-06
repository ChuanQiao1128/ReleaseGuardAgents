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
import { ScannerCoverage } from "./types";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type ApiScanResult = {
  apiNode: CapabilityNode;
  fileNodeId: string;
  absolutePath: string;
  relativePath: string;
  method: string;
  path: string;
};

export async function scanNextApis(
  rootDir: string,
  appDir: string,
  graph: CapabilityGraph,
  coverage: ScannerCoverage,
): Promise<ApiScanResult[]> {
  const apiFiles = await listFiles(appDir, (filePath) => {
    return (
      filePath.endsWith(`${path.sep}route.ts`) &&
      filePath.includes(`${path.sep}api${path.sep}`)
    );
  });
  const apis: ApiScanResult[] = [];

  for (const apiFile of apiFiles) {
    const relativePath = toRepoRelativePath(rootDir, apiFile);
    const source = await fs.readFile(apiFile, "utf8");
    const fileNode = addFileNode(graph, rootDir, apiFile, "nextjs_api_file");
    const apiPath = apiPathFromRouteFile(appDir, apiFile);

    for (const method of HTTP_METHODS) {
      const methodRegex = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b`,
        "g",
      );
      const match = methodRegex.exec(source);
      if (!match) {
        continue;
      }
      const line = lineForIndex(source, match.index);
      const target = `${method} ${apiPath}`;
      const apiNode: CapabilityNode = {
        id: apiNodeId(method, apiPath),
        type: "api",
        name: target,
        target,
        filePath: relativePath,
        risk: apiPath.startsWith("/api/discount") ? "high" : "medium",
        confidence: "high",
        confidenceBasis: "nextjs_route_handler_export",
        evidenceRefs: [
          {
            filePath: relativePath,
            lineStart: line,
            lineEnd: line,
            quote: lineQuote(source, line),
            reason: `Next.js route handler exports ${method}.`,
          },
        ],
        metadata: { method, path: apiPath },
      };
      addNode(graph, apiNode);
      addEdge(
        graph,
        defineEdge(
          fileNode.id,
          apiNode.id,
          apiNode.evidenceRefs,
          "nextjs_route_handler_export",
        ),
      );
      coverage.detectedApis.push({
        id: apiNode.id,
        target,
        filePath: relativePath,
      });
      apis.push({
        apiNode,
        fileNodeId: fileNode.id,
        absolutePath: apiFile,
        relativePath,
        method,
        path: apiPath,
      });
    }
  }

  return apis;
}

function apiPathFromRouteFile(appDir: string, routeFile: string): string {
  const routeDir = path.dirname(routeFile);
  const relative = path.relative(path.join(appDir, "api"), routeDir);
  const segments = relative.split(path.sep).filter(Boolean);
  return `/api/${segments.join("/")}`;
}

