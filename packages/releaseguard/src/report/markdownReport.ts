import path from "node:path";
import { ChangeImpactAgentOutput } from "../agents/schemas";
import { DecisionResult } from "../decision/decisionEngine";
import { ChangeScope } from "../diff/diffParser";
import { EvidencePlan } from "../evidence/types";
import { EvidenceExecutionResult } from "../executor/selectedTestExecutor";
import { CapabilityGraph } from "../graph/types";

export function renderMarkdownReport(input: {
  graph: CapabilityGraph;
  scope: ChangeScope;
  impact: ChangeImpactAgentOutput;
  evidencePlan: EvidencePlan;
  executionResult: EvidenceExecutionResult;
  decision: DecisionResult;
  graphPath?: string;
  coveragePath?: string;
  artifactDir: string;
}): string {
  const rel = (filePath: string) =>
    path.relative(input.graph.rootDir, filePath).split(path.sep).join("/");

  return [
    "# ReleaseGuard Report",
    "",
    `Decision: ${input.decision.decision}`,
    "",
    "## Changed files",
    ...changedFileLines(input.scope),
    "",
    "## Affected capabilities",
    ...listOrNone(
      input.impact.affected_capability_ids.map((id) => {
        const node = input.graph.nodes[id];
        return `- ${id}: ${node?.target ?? node?.name ?? "unknown"} (${node?.type ?? "unknown"})`;
      }),
    ),
    "",
    "## Selected evidence",
    ...listOrNone(
      input.evidencePlan.selectedEvidence.map(
        (evidence) =>
          `- ${evidence.testId}: ${evidence.testFile} for ${evidence.capabilityId} (${evidence.caseTags.join(", ")})`,
      ),
    ),
    "",
    "## Missing evidence",
    ...listOrNone(
      input.evidencePlan.missingEvidence.map(
        (missing) =>
          `- ${missing.capabilityId}: ${missing.reason} (${missing.requiredTags.join(", ")})`,
      ),
    ),
    "",
    "## Test results",
    ...listOrNone(
      input.executionResult.results.map(
        (result) =>
          `- ${result.testFile}: ${result.outcome.toUpperCase()} (exit ${result.exitCode ?? "null"}, ${result.durationMs}ms)`,
      ),
    ),
    "",
    "## Decision rationale",
    `- ${input.decision.reason}`,
    "",
    "## Scanner coverage",
    ...scannerCoverageLines(input.graphPath, input.coveragePath, rel),
    "",
    "## Artifacts",
    `- Report directory: ${rel(input.artifactDir)}`,
    `- Evidence result: ${rel(input.executionResult.artifactPath)}`,
    `- Test results: ${rel(input.executionResult.testResultsPath)}`,
    "",
  ].join("\n");
}

function changedFileLines(scope: ChangeScope): string[] {
  const prefix =
    scope.mode === "fixture" ? `Fixture: ${scope.fixture}` : `Diff: ${scope.base}..${scope.head}`;
  return [prefix, ...scope.changedFiles.map((filePath) => `- ${filePath}`)];
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items : ["- None"];
}

function scannerCoverageLines(
  graphPath: string | undefined,
  coveragePath: string | undefined,
  rel: (filePath: string) => string,
): string[] {
  if (!graphPath || !coveragePath) {
    return ["- Skipped for low-risk docs-only change."];
  }

  return [
    `- Capability graph: ${rel(graphPath)}`,
    `- Coverage report: ${rel(coveragePath)}`,
  ];
}
