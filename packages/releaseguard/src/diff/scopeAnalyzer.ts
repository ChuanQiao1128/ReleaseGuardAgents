export type ScopeClassification =
  | "docs_only"
  | "source_or_test_change"
  | "config_or_dependency_change"
  | "unknown";

export type ScopeAnalysis = {
  classification: ScopeClassification;
  reason: string;
};

const DOCS_ONLY_FILES = new Set([
  "README.md",
  "SECURITY_NOTES.md",
  "DESIGN.md",
]);

const CONFIG_OR_DEPENDENCY_FILE_PATTERNS = [
  /^package(-lock)?\.json$/,
  /(^|\/)package(-lock)?\.json$/,
  /(^|\/)tsconfig\.json$/,
  /(^|\/)next\.config\.[cm]?[jt]s$/,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /^\.env/,
  /(^|\/)\.env/,
  /(^|\/)Dockerfile$/,
];

export function analyzeScope(changedFiles: string[]): ScopeAnalysis {
  if (changedFiles.length === 0) {
    return {
      classification: "unknown",
      reason: "No changed files were provided.",
    };
  }

  if (changedFiles.every(isDocsOnlyPath)) {
    return {
      classification: "docs_only",
      reason: "Changed files are limited to low-risk documentation files.",
    };
  }

  if (changedFiles.some(isConfigOrDependencyPath)) {
    return {
      classification: "config_or_dependency_change",
      reason: "Config or dependency changes are not fast-skipped in v0.1.3.",
    };
  }

  if (changedFiles.some(isSourceOrTestPath)) {
    return {
      classification: "source_or_test_change",
      reason: "Source or test files changed.",
    };
  }

  return {
    classification: "unknown",
    reason: "Changed files are outside v0.1.3 fast-skip rules.",
  };
}

export function isDocsOnlyPath(filePath: string): boolean {
  return DOCS_ONLY_FILES.has(filePath) || /^docs\/.+\.md$/.test(filePath);
}

export function isConfigOrDependencyPath(filePath: string): boolean {
  return CONFIG_OR_DEPENDENCY_FILE_PATTERNS.some((pattern) =>
    pattern.test(filePath),
  );
}

function isSourceOrTestPath(filePath: string): boolean {
  return (
    /\.(ts|tsx|js|jsx)$/.test(filePath) ||
    filePath.includes("/src/") ||
    filePath.includes("/tests/")
  );
}
