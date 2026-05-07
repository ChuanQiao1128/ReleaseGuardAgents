import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeScope } from "../src/diff/scopeAnalyzer";
import { planEvidence } from "../src/evidence/evidencePlanner";
import { ChangeScope } from "../src/diff/diffParser";
import { applyDemoMissingEvidenceFixture } from "../src/fixtures/regressionFixture";
import { scanRepository } from "../src/scanner/repoScanner";
import { ingestCoverageFile } from "../src/coverage/coverageIngest";
import { runReleaseGuardWithScope } from "../src/run";

const repoRoot = path.resolve(process.cwd(), "../..");

describe("coverage evidence integration", () => {
  it("keeps invalid_discount missing when only coverage evidence exists", async () => {
    const fixture = await applyDemoMissingEvidenceFixture(repoRoot);
    try {
      const { graph } = await scanRepository(repoRoot);
      const coverageReport = await ingestCoverageFile({
        repoRoot,
        coverageFile: "packages/releaseguard/fixtures/coverage/lcov.info",
      });
      const plan = planEvidence({
        graph,
        affectedCapabilityIds: ["api_apply_discount"],
        coverageReport,
        changedFiles: ["apps/demo-app/src/app/api/discount/apply/route.ts"],
      });

      expect(plan.selectedEvidence).toHaveLength(0);
      expect(plan.missingEvidence).toContainEqual(
        expect.objectContaining({
          capabilityId: "api_apply_discount",
          requiredTags: ["invalid_discount", "400", "error_status"],
        }),
      );
      expect(plan.coverageEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capability_id: "api_apply_discount",
            evidence_type: "coverage_file_evidence",
            file_path: "apps/demo-app/src/app/api/discount/apply/route.ts",
          }),
        ]),
      );
    } finally {
      await fixture.restore();
    }
  });

  it("reports coverage for unmapped source changes but keeps WARN", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "releaseguard-run-coverage-"));
    const coverageFile = path.join(tempDir, "lcov.info");
    await fs.writeFile(
      coverageFile,
      [
        "SF:packages/releaseguard/src/coverage/lcovParser.ts",
        "DA:1,1",
        "DA:2,1",
        "LH:2",
        "LF:2",
        "end_of_record",
      ].join("\n"),
    );

    const result = await runReleaseGuardWithScope({
      rootDir: repoRoot,
      scope: makeGitScope(["packages/releaseguard/src/coverage/lcovParser.ts"]),
      coverageFile,
    });
    const report = await fs.readFile(result.reportPath, "utf8");

    expect(result.decision.decision).toBe("WARN");
    expect(result.evidencePlan.coverageEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file_path: "packages/releaseguard/src/coverage/lcovParser.ts",
          evidence_type: "coverage_file_evidence",
        }),
      ]),
    );
    expect(report).toContain("## Coverage evidence");
    expect(report).toContain("packages/releaseguard/src/coverage/lcovParser.ts");
    expect(report).toContain("does not prove the specific business case");
  });
});

function makeGitScope(changedFiles: string[]): ChangeScope {
  const scope = analyzeScope(changedFiles);
  return {
    mode: "git",
    base: "base-ref",
    head: "head-ref",
    changedFiles,
    changedFileDetails: changedFiles.map((filePath) => ({
      path: filePath,
      status: "unknown",
    })),
    scope,
    docsOnly: scope.classification === "docs_only",
  };
}

