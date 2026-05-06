import path from "node:path";
import {
  CapabilityEdge,
  CapabilityEdgeType,
  CapabilityGraph,
  CapabilityNode,
  ConfidenceLevel,
  EvidenceRef,
  RiskLevel,
} from "./types";

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function toRepoRelativePath(rootDir: string, filePath: string): string {
  return normalizePath(path.relative(rootDir, filePath));
}

export function sanitizeIdPart(value: string): string {
  return value
    .replace(/^[A-Z]+ /, "")
    .replace(/^\/+/, "")
    .replace(/\.[tj]sx?$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function fileNodeId(filePath: string): string {
  return `file_${sanitizeIdPart(filePath)}`;
}

export function routeNodeId(routePath: string): string {
  const part = sanitizeIdPart(routePath) || "root";
  return `route_${part}`;
}

export function apiNodeId(method: string, apiPath: string): string {
  const segments = apiPath.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const idParts =
    segments.length > 1
      ? [segments[segments.length - 1], ...segments.slice(0, -1)]
      : segments;
  const part = sanitizeIdPart(idParts.join("_")) || sanitizeIdPart(apiPath);
  return `api_${part}`;
}

export function edgeId(
  source: string,
  type: CapabilityEdgeType,
  target: string,
): string {
  return `edge_${source}_${type}_${target}`;
}

export function createCapabilityGraph(rootDir: string): CapabilityGraph {
  return {
    version: "releaseguard-v0.1",
    rootDir,
    generatedAt: new Date().toISOString(),
    nodes: {},
    edges: {},
  };
}

export function addNode(graph: CapabilityGraph, node: CapabilityNode): void {
  graph.nodes[node.id] = node;
}

export function addFileNode(
  graph: CapabilityGraph,
  rootDir: string,
  absolutePath: string,
  confidenceBasis = "file_scanned",
): CapabilityNode {
  const relativePath = toRepoRelativePath(rootDir, absolutePath);
  const node: CapabilityNode = {
    id: fileNodeId(relativePath),
    type: "file",
    name: relativePath,
    filePath: relativePath,
    risk: "low",
    confidence: "high",
    confidenceBasis,
    evidenceRefs: [
      {
        filePath: relativePath,
        reason: "File was included in the v0.1 scanner pass.",
      },
    ],
    metadata: {},
  };
  addNode(graph, node);
  return node;
}

export function addEdge(graph: CapabilityGraph, edge: CapabilityEdge): void {
  graph.edges[edge.id] = edge;
}

export function defineEdge(
  source: string,
  target: string,
  evidenceRefs: EvidenceRef[],
  confidenceBasis: string,
): CapabilityEdge {
  return {
    id: edgeId(source, "defines", target),
    type: "defines",
    source,
    target,
    confidence: "high",
    confidenceBasis,
    evidenceRefs,
    metadata: {},
  };
}

export function makeEdge(
  source: string,
  type: CapabilityEdgeType,
  target: string,
  confidence: ConfidenceLevel,
  confidenceBasis: string,
  evidenceRefs: EvidenceRef[],
  metadata: Record<string, unknown> = {},
): CapabilityEdge {
  return {
    id: edgeId(source, type, target),
    type,
    source,
    target,
    confidence,
    confidenceBasis,
    evidenceRefs,
    metadata,
  };
}

export function getNodeRisk(
  graph: CapabilityGraph,
  capabilityId: string,
): RiskLevel {
  return graph.nodes[capabilityId]?.risk ?? "medium";
}

export function findDefinedCapabilitiesForFile(
  graph: CapabilityGraph,
  filePath: string,
): CapabilityNode[] {
  const normalized = normalizePath(filePath);
  const file = Object.values(graph.nodes).find(
    (node) => node.type === "file" && node.filePath === normalized,
  );
  if (!file) {
    return [];
  }

  return Object.values(graph.edges)
    .filter((edge) => edge.type === "defines" && edge.source === file.id)
    .map((edge) => graph.nodes[edge.target])
    .filter((node): node is CapabilityNode => Boolean(node));
}

export function findConsumersOfCapability(
  graph: CapabilityGraph,
  capabilityId: string,
): CapabilityNode[] {
  return Object.values(graph.edges)
    .filter((edge) => edge.type === "consumes" && edge.target === capabilityId)
    .map((edge) => graph.nodes[edge.source])
    .filter((node): node is CapabilityNode => Boolean(node));
}

export function findTestsForCapability(
  graph: CapabilityGraph,
  capabilityId: string,
): CapabilityNode[] {
  return Object.values(graph.edges)
    .filter((edge) => edge.type === "tested_by" && edge.source === capabilityId)
    .map((edge) => graph.nodes[edge.target])
    .filter((node): node is CapabilityNode => Boolean(node));
}

