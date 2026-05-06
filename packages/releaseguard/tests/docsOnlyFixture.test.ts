import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runReleaseGuard } from "../src/run";

const repoRoot = path.resolve(process.cwd(), "../..");

describe("demo-docs-only fixture", () => {
  it("fast-skips docs-only changes with PASS and no selected tests", async () => {
    const result = await runReleaseGuard({
      rootDir: repoRoot,
      fixture: "demo-docs-only",
    });
    const report = await fs.readFile(result.reportPath, "utf8");

    expect(result.decision).toEqual({
      decision: "PASS",
      reason: "low-risk docs-only change.",
    });
    expect(result.impact.affected_capability_ids).toHaveLength(0);
    expect(result.evidencePlan.selectedEvidence).toHaveLength(0);
    expect(result.evidencePlan.missingEvidence).toHaveLength(0);
    expect(result.executionResult.results).toHaveLength(0);
    expect(report).toContain("Fixture: demo-docs-only");
    expect(report).toContain("Decision: PASS");
    expect(report).toContain("## Affected capabilities\n- None");
    expect(report).toContain("## Selected evidence\n- None");
    expect(report).toContain("## Test results\n- None");
    expect(report).toContain("Skipped for low-risk docs-only change.");
  });
});

