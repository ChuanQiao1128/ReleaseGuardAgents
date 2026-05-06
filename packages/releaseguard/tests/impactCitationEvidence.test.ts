import path from "node:path";
import { describe, expect, it } from "vitest";
import { DeterministicChangeImpactAgent } from "../src/agents/changeImpactAgent";
import { validateChangeImpactOutput } from "../src/citations/citationValidator";
import { planEvidence } from "../src/evidence/evidencePlanner";
import { scanRepository } from "../src/scanner/repoScanner";

const repoRoot = path.resolve(process.cwd(), "../..");

async function demoGraph() {
  return (await scanRepository(repoRoot)).graph;
}

describe("change impact fallback, citations, and evidence", () => {
  it("identifies changed discount API and consuming checkout route", async () => {
    const graph = await demoGraph();
    const output = await new DeterministicChangeImpactAgent().analyze({
      graph,
      changedFiles: ["apps/demo-app/src/app/api/discount/apply/route.ts"],
    });

    expect(output.affected_capability_ids).toEqual(
      expect.arrayContaining(["api_apply_discount", "route_checkout"]),
    );
    expect(validateChangeImpactOutput(graph, output).valid).toBe(true);
  });

  it("rejects nonexistent affected capability IDs", async () => {
    const graph = await demoGraph();
    const result = validateChangeImpactOutput(graph, {
      affected_capability_ids: ["api_does_not_exist"],
      rationale_per_capability: {},
      citations: [],
      unresolved_items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("Unknown affected capability ID");
  });

  it("rejects nonexistent citation IDs", async () => {
    const graph = await demoGraph();
    const result = validateChangeImpactOutput(graph, {
      affected_capability_ids: ["api_apply_discount"],
      rationale_per_capability: {
        api_apply_discount: "test",
      },
      citations: [
        {
          source_id: "edge_does_not_exist",
          source_type: "edge",
          reason: "test",
        },
      ],
      unresolved_items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("Unknown citation edge ID");
  });

  it("rejects citations outside the affected graph slice", async () => {
    const graph = await demoGraph();
    const result = validateChangeImpactOutput(graph, {
      affected_capability_ids: ["api_apply_discount"],
      rationale_per_capability: {
        api_apply_discount: "changed API",
      },
      citations: [
        {
          source_id: "route_checkout",
          source_type: "node",
          evidence_ref_index: 0,
          reason: "unrelated route citation",
        },
      ],
      unresolved_items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "Citation node ID is not part of affected graph slice",
    );
  });

  it("accepts valid API and route citations", async () => {
    const graph = await demoGraph();
    const result = validateChangeImpactOutput(graph, {
      affected_capability_ids: ["api_apply_discount", "route_checkout"],
      rationale_per_capability: {
        api_apply_discount: "changed API",
        route_checkout: "consumes API",
      },
      citations: [
        {
          source_id: "api_apply_discount",
          source_type: "node",
          evidence_ref_index: 0,
          reason: "changed API",
        },
        {
          source_id: "route_checkout",
          source_type: "node",
          evidence_ref_index: 0,
          reason: "consumer route",
        },
      ],
      unresolved_items: [],
    });

    expect(result.valid).toBe(true);
  });

  it("rejects forbidden agent decision, risk, merge, and severity fields", async () => {
    const graph = await demoGraph();
    for (const field of [
      "decision",
      "should_block",
      "should_merge",
      "risk",
      "severity_total",
    ]) {
      const result = validateChangeImpactOutput(graph, {
        affected_capability_ids: ["api_apply_discount"],
        rationale_per_capability: {
          api_apply_discount: "changed API",
        },
        citations: [],
        unresolved_items: [],
        [field]: "forbidden",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.join("\n")).toContain(
        "Forbidden agent output field",
      );
    }
  });

  it("selects only invalid discount evidence for api_apply_discount", async () => {
    const graph = await demoGraph();
    const plan = planEvidence({
      graph,
      affectedCapabilityIds: ["api_apply_discount", "route_checkout"],
    });

    expect(plan.selectedEvidence).toContainEqual(
      expect.objectContaining({
        capabilityId: "api_apply_discount",
        testId: "test_api_discount_invalid",
        testFile: "tests/api/discount.test.ts",
        caseTags: expect.arrayContaining([
          "invalid_discount",
          "400",
          "error_status",
        ]),
      }),
    );
    expect(plan.missingEvidence).toHaveLength(0);
  });
});
