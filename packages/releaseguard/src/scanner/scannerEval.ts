import { promises as fs } from "node:fs";
import path from "node:path";
import { ingestCoverageFile } from "../coverage/coverageIngest";
import { CoverageReport } from "../coverage/types";
import { CapabilityGraph } from "../graph/types";
import { ResolutionLevelCounts, emptyResolutionLevelCounts } from "../impact/resolutionLevel";
import { detectFramework } from "./frameworkDetector";
import { renderSuggestedOverrideSnippet, suggestOverrides, SuggestedOverride } from "./overrideSuggestion";
import { scanRepository } from "./repoScanner";
import { ScannerCoverage, UnresolvedCallsite } from "./types";
import {
  classifyUnresolvedPattern,
  UnresolvedPatternCategory,
} from "./unresolvedPatternClassifier";

export type ScannerEvalResult = {
  repo_path: string;
  framework_detected: string;
  supported: boolean;
  scanned_file_count: number;
  routes_detected: number;
  apis_detected: number;
  tests_detected: number;
  frontend_api_callsites_detected: number;
  resolved_callsites: number;
  unresolved_callsites: number;
  unresolved_rate: number;
  scanner_error_count: number;
  module_nodes_detected: number;
  package_nodes_detected: number;
  universal_fallback_nodes: number;
  framework_capability_nodes: number;
  coverage_file_count: number;
  coverage_matched_file_count: number;
  top_unresolved_patterns: Array<{
    pattern: UnresolvedPatternCategory;
    count: number;
  }>;
  file_role_counts: Record<string, number>;
  resolution_level_distribution: ResolutionLevelCounts;
  suggested_overrides: SuggestedOverride[];
  output_dir: string;
  report_path: string;
  graph_path?: string;
  unresolved_report_path: string;
};

export async function runScannerEval(args: {
  workspaceRoot: string;
  repoRoot: string;
  coverageFile?: string;
}): Promise<ScannerEvalResult> {
  const repoRoot = path.resolve(args.repoRoot);
  const outputDir = path.join(
    args.workspaceRoot,
    ".releaseguard",
    "scanner_eval",
    sanitizeRepoName(path.basename(repoRoot) || "repo"),
  );
  await fs.mkdir(outputDir, { recursive: true });

  const framework = await detectFramework(repoRoot);
  const frameworkDetected = framework.isNextAppRouter
    ? `nextjs_app_router${framework.isTypeScript ? "_typescript" : ""}`
    : "unsupported_framework";

  let coverage = emptyCoverage();
  let graph: CapabilityGraph | undefined;
  let scannerError: string | undefined;
  let coverageReport: CoverageReport | undefined;
  let coverageError: string | undefined;

  try {
    const scan = await scanRepository(repoRoot);
    coverage = {
      ...scan.result.coverage,
      unresolvedCallsites: scan.result.coverage.unresolvedCallsites.map(
        withPattern,
      ),
    };
    graph = scan.graph;
    if (!framework.isNextAppRouter || !framework.isTypeScript) {
      scannerError = "unsupported framework route/API adapter";
    }
  } catch (error) {
    scannerError = error instanceof Error ? error.message : String(error);
  }

  if (args.coverageFile) {
    try {
      coverageReport = await ingestCoverageFile({
        repoRoot,
        coverageFile: args.coverageFile,
      });
    } catch (error) {
      coverageError = error instanceof Error ? error.message : String(error);
    }
  }

  if (
    (!framework.isNextAppRouter || !framework.isTypeScript) &&
    coverage.unresolvedCallsites.length === 0
  ) {
    coverage.unresolvedCallsites.push({
      filePath: ".",
      line: 1,
      reason: "unsupported framework for route/API scanner; universal fallback ran",
      quote: frameworkDetected,
      confidence: "unresolved",
      pattern: "unsupported_framework",
    });
  }

  const unresolvedCallsites = coverage.unresolvedCallsites.map(withPattern);
  const patternCounts = unresolvedPatternCounts(unresolvedCallsites);
  const suggestions = suggestOverrides({ coverage, unresolvedCallsites });
  const coverageMatch = matchCoverageToGraph(graph, coverageReport);
  if (coverageMatch.matched_file_count > 0) {
    coverage.resolutionLevelCounts = {
      ...coverage.resolutionLevelCounts,
      L4_TEST_EVIDENCE_MAPPED:
        (coverage.resolutionLevelCounts?.L4_TEST_EVIDENCE_MAPPED ?? 0) +
        coverageMatch.matched_file_count,
    };
  }
  const graphPath = graph
    ? path.join(outputDir, "capability_graph.json")
    : undefined;
  if (graphPath) {
    await fs.writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  }

  const unresolvedReportPath = path.join(outputDir, "unresolved_report.json");
  const contribution = graphContribution(graph);
  await fs.writeFile(
    unresolvedReportPath,
    `${JSON.stringify({
      repo_path: repoRoot,
      framework_detected: frameworkDetected,
      unresolved_callsite_count: unresolvedCallsites.length,
      unresolved_callsite_rate: unresolvedRate(coverage),
      top_unresolved_patterns: patternCounts,
      file_role_counts: coverage.fileRoleCounts ?? {},
      resolution_level_distribution: normalizedResolutionCounts(coverage),
      adapter_contribution: contribution,
      coverage: coverageReport
        ? {
            provider: coverageReport.provider,
            file_count: coverageReport.file_count,
            covered_file_count: coverageReport.covered_file_count,
            matched_file_count: coverageMatch.matched_file_count,
            matched_files: coverageMatch.matched_files,
          }
        : undefined,
      unresolved_callsites: unresolvedCallsites,
      suggested_overrides: suggestions,
    }, null, 2)}\n`,
  );

  const reportPath = path.join(outputDir, "scanner_eval_report.md");
  const result: ScannerEvalResult = {
    repo_path: repoRoot,
    framework_detected: frameworkDetected,
    supported: framework.isNextAppRouter && framework.isTypeScript && !scannerError,
    scanned_file_count: coverage.scannedFiles.length,
    routes_detected: coverage.detectedRoutes.length,
    apis_detected: coverage.detectedApis.length,
    tests_detected: graph
      ? Object.values(graph.nodes).filter((node) => node.type === "test").length
      : 0,
    frontend_api_callsites_detected:
      coverage.resolvedCallsites.length + unresolvedCallsites.length,
    resolved_callsites: coverage.resolvedCallsites.length,
    unresolved_callsites: unresolvedCallsites.length,
    unresolved_rate: unresolvedRate(coverage),
    scanner_error_count: scannerError ? 1 : 0,
    module_nodes_detected: contribution.module_nodes,
    package_nodes_detected: contribution.package_nodes,
    universal_fallback_nodes: contribution.universal_fallback_nodes,
    framework_capability_nodes: contribution.framework_capability_nodes,
    coverage_file_count: coverageReport?.file_count ?? 0,
    coverage_matched_file_count: coverageMatch.matched_file_count,
    top_unresolved_patterns: patternCounts,
    file_role_counts: coverage.fileRoleCounts ?? {},
    resolution_level_distribution: normalizedResolutionCounts(coverage),
    suggested_overrides: suggestions,
    output_dir: outputDir,
    report_path: reportPath,
    graph_path: graphPath,
    unresolved_report_path: unresolvedReportPath,
  };

  await fs.writeFile(
    reportPath,
    renderScannerEvalMarkdown({
      result,
      coverage: { ...coverage, unresolvedCallsites },
      scannerError,
      coverageReport,
      coverageError,
      coverageMatchedFiles: coverageMatch.matched_files,
    }),
  );

  return result;
}

function renderScannerEvalMarkdown(args: {
  result: ScannerEvalResult;
  coverage: ScannerCoverage;
  scannerError?: string;
  coverageReport?: CoverageReport;
  coverageError?: string;
  coverageMatchedFiles?: string[];
}): string {
  return [
    "# ReleaseGuard Scanner Eval",
    "",
    `Repo path: ${args.result.repo_path}`,
    `Framework detected: ${args.result.framework_detected}`,
    `Supported by current scanner: ${args.result.supported ? "yes" : "no"}`,
    `Scanner errors: ${args.result.scanner_error_count}`,
    ...(args.scannerError ? [`Scanner error detail: ${args.scannerError}`] : []),
    "",
    "## Metrics",
    "",
    `- Scanned files: ${args.result.scanned_file_count}`,
    `- Detected routes: ${args.result.routes_detected}`,
    `- Detected APIs: ${args.result.apis_detected}`,
    `- Detected test nodes: ${args.result.tests_detected}`,
    `- Detected frontend->API callsites: ${args.result.frontend_api_callsites_detected}`,
    `- Resolved callsites: ${args.result.resolved_callsites}`,
    `- Unresolved callsites: ${args.result.unresolved_callsites}`,
    `- Unresolved rate: ${formatPercent(args.result.unresolved_rate)}`,
    `- Detected module nodes: ${args.result.module_nodes_detected}`,
    `- Detected package nodes: ${args.result.package_nodes_detected}`,
    `- Coverage files matched: ${args.result.coverage_matched_file_count}`,
    "",
    "## File role counts",
    ...listOrNone(
      Object.entries(args.result.file_role_counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([role, count]) => `- ${role}: ${count}`),
    ),
    "",
    "## Resolution level distribution",
    ...Object.entries(args.result.resolution_level_distribution).map(
      ([level, count]) => `- ${level}: ${count}`,
    ),
    "",
    "## Adapter contribution",
    `- Universal fallback nodes: ${args.result.universal_fallback_nodes}`,
    `- Framework capability nodes: ${args.result.framework_capability_nodes}`,
    `- Test evidence nodes: ${args.result.tests_detected}`,
    `- Universal fallback contribution: file/module/package impact context for every scanned repo.`,
    `- Framework adapter contribution: route/API precision when the repository matches a supported adapter.`,
    "",
    "## Coverage evidence",
    ...coverageEvidenceLines(
      args.coverageReport,
      args.coverageError,
      args.coverageMatchedFiles ?? [],
    ),
    "",
    "## Fail-safe implication",
    ...failSafeImplicationLines(args.result),
    "",
    "## Detected routes",
    ...listOrNone(
      args.coverage.detectedRoutes.map(
        (route) => `- ${route.id}: ${route.target} (${route.filePath})`,
      ),
    ),
    "",
    "## Detected APIs",
    ...listOrNone(
      args.coverage.detectedApis.map(
        (api) => `- ${api.id}: ${api.target} (${api.filePath})`,
      ),
    ),
    "",
    "## Resolved frontend->API callsites",
    ...listOrNone(
      args.coverage.resolvedCallsites.map(
        (callsite) =>
          `- ${callsite.routeId} consumes ${callsite.apiId} at ${callsite.filePath}:${callsite.line} (${callsite.confidenceBasis})`,
      ),
    ),
    "",
    "## Unresolved callsites",
    ...listOrNone(
      args.coverage.unresolvedCallsites.map(
        (callsite) =>
          `- ${callsite.pattern ?? classifyUnresolvedPattern(callsite)}: ${callsite.filePath}:${callsite.line}: ${callsite.reason}`,
      ),
    ),
    "",
    "## Top unresolved pattern categories",
    ...listOrNone(
      args.result.top_unresolved_patterns.map(
        (entry) => `- ${entry.pattern}: ${entry.count}`,
      ),
    ),
    "",
    "## Suggested override snippets",
    ...renderSuggestedOverrideSnippet(args.result.suggested_overrides),
    "",
    "## Artifacts",
    `- Scanner eval report: ${args.result.report_path}`,
    `- Capability graph: ${args.result.graph_path ?? "not generated"}`,
    `- Unresolved report: ${args.result.unresolved_report_path}`,
    "",
  ].join("\n");
}

function coverageEvidenceLines(
  coverageReport: CoverageReport | undefined,
  coverageError: string | undefined,
  matchedFiles: string[],
): string[] {
  if (coverageError) {
    return [`- Coverage parse error: ${coverageError}`];
  }
  if (!coverageReport) {
    return ["- No coverage report provided."];
  }
  return [
    `- Provider: ${coverageReport.provider}`,
    `- Files in coverage report: ${coverageReport.file_count}`,
    `- Covered files in coverage report: ${coverageReport.covered_file_count}`,
    `- Matched graph files: ${matchedFiles.length}`,
    ...listOrNone(
      matchedFiles.map((filePath) => {
        const record = coverageReport.records.find(
          (item) => item.normalized_file_path === filePath,
        );
        return `- ${filePath}: ${record?.line_coverage_percent.toFixed(2) ?? "0.00"}% line coverage`;
      }),
    ),
    "- Limitation: coverage shows a file was executed by tests, but does not prove a specific business case was asserted.",
  ];
}

function graphContribution(graph: CapabilityGraph | undefined): {
  file_nodes: number;
  module_nodes: number;
  package_nodes: number;
  universal_fallback_nodes: number;
  framework_capability_nodes: number;
} {
  const nodes = Object.values(graph?.nodes ?? {});
  const file_nodes = nodes.filter((node) => node.type === "file").length;
  const module_nodes = nodes.filter((node) => node.type === "module").length;
  const package_nodes = nodes.filter((node) => node.type === "package").length;
  const framework_capability_nodes = nodes.filter(
    (node) => node.type === "route" || node.type === "api",
  ).length;
  return {
    file_nodes,
    module_nodes,
    package_nodes,
    universal_fallback_nodes: file_nodes + module_nodes + package_nodes,
    framework_capability_nodes,
  };
}

function matchCoverageToGraph(
  graph: CapabilityGraph | undefined,
  coverageReport: CoverageReport | undefined,
): { matched_file_count: number; matched_files: string[] } {
  if (!graph || !coverageReport) {
    return {
      matched_file_count: 0,
      matched_files: [],
    };
  }
  const graphFiles = new Set(
    Object.values(graph.nodes)
      .filter((node) => node.type === "file" && node.filePath)
      .map((node) => node.filePath as string),
  );
  const matchedFiles = coverageReport.records
    .map((record) => record.normalized_file_path)
    .filter((filePath) => graphFiles.has(filePath))
    .sort();
  return {
    matched_file_count: matchedFiles.length,
    matched_files: matchedFiles,
  };
}

function failSafeImplicationLines(result: ScannerEvalResult): string[] {
  if (!result.supported) {
    return [
      "- Route/API precision is unavailable for this repository.",
      "- Source, config, or dependency changes should be treated as fail-safe WARN unless coverage, declarations, contracts, or a framework adapter provide stronger evidence.",
    ];
  }
  if (result.unresolved_callsites > 0) {
    return [
      "- Supported framework adapter ran, but unresolved callsites remain.",
      "- Changes touching unresolved areas should stay WARN until an override, declaration, or scanner improvement proves the mapping.",
    ];
  }
  return [
    "- Supported framework adapter ran without unresolved frontend-to-API callsites in this scanner eval.",
    "- Enforcement should still depend on changed-file impact and selected evidence results, not scanner support alone.",
  ];
}

function unresolvedPatternCounts(unresolved: UnresolvedCallsite[]): Array<{
  pattern: UnresolvedPatternCategory;
  count: number;
}> {
  const counts = new Map<UnresolvedPatternCategory, number>();
  for (const callsite of unresolved) {
    const pattern = callsite.pattern ?? classifyUnresolvedPattern(callsite);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern));
}

function unresolvedRate(coverage: ScannerCoverage): number {
  const total = coverage.resolvedCallsites.length + coverage.unresolvedCallsites.length;
  return total === 0 ? 0 : coverage.unresolvedCallsites.length / total;
}

function withPattern(callsite: UnresolvedCallsite): UnresolvedCallsite {
  return {
    ...callsite,
    pattern: callsite.pattern ?? classifyUnresolvedPattern(callsite),
  };
}

function emptyCoverage(): ScannerCoverage {
  return {
    scannedFiles: [],
    detectedRoutes: [],
    detectedApis: [],
    resolvedCallsites: [],
    unresolvedCallsites: [],
    confidenceBreakdown: {
      high: 0,
      medium: 0,
      low: 0,
      unresolved: 0,
    },
    fileRoleCounts: {},
    resolutionLevelCounts: {},
    limitations: [],
  };
}

function normalizedResolutionCounts(
  coverage: ScannerCoverage,
): ResolutionLevelCounts {
  return {
    ...emptyResolutionLevelCounts(),
    ...coverage.resolutionLevelCounts,
  };
}

function sanitizeRepoName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-") || "repo";
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items : ["- None"];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
