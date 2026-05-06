import { describe, expect, it } from "vitest";
import {
  apiNodeId,
  createCapabilityGraph,
  makeEdge,
  routeNodeId,
} from "../src/graph/capabilityGraph";
import { capabilityGraphSchema } from "../src/graph/types";

describe("capability graph schema", () => {
  it("uses expected v0.1 stable IDs", () => {
    expect(routeNodeId("/checkout")).toBe("route_checkout");
    expect(apiNodeId("POST", "/api/discount/apply")).toBe(
      "api_apply_discount",
    );
  });

  it("accepts v0.1 graph node and edge types", () => {
    const graph = createCapabilityGraph("/repo");
    graph.nodes.route_checkout = {
      id: "route_checkout",
      type: "route",
      name: "/checkout",
      target: "/checkout",
      risk: "high",
      confidence: "high",
      confidenceBasis: "nextjs_file_route",
      evidenceRefs: [{ filePath: "page.tsx", reason: "test" }],
      metadata: {},
    };
    graph.nodes.api_apply_discount = {
      id: "api_apply_discount",
      type: "api",
      name: "POST /api/discount/apply",
      target: "POST /api/discount/apply",
      risk: "high",
      confidence: "high",
      confidenceBasis: "nextjs_route_handler_export",
      evidenceRefs: [{ filePath: "route.ts", reason: "test" }],
      metadata: {},
    };
    const edge = makeEdge(
      "route_checkout",
      "consumes",
      "api_apply_discount",
      "high",
      "direct_fetch_literal",
      [{ filePath: "component.tsx", reason: "test" }],
    );
    graph.edges[edge.id] = edge;

    expect(capabilityGraphSchema.parse(graph).edges[edge.id].type).toBe(
      "consumes",
    );
  });
});

