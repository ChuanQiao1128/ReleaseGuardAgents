import path from "node:path";
import { normalizePath, sanitizeIdPart } from "../graph/capabilityGraph";

export function normalizeCoverageFilePath(
  repoRoot: string,
  filePath: string,
): string | undefined {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalizedInput = normalizePath(trimmed.replace(/^file:\/\//, ""));
  if (path.isAbsolute(normalizedInput)) {
    const relativePath = normalizePath(path.relative(repoRoot, normalizedInput));
    if (relativePath === "" || relativePath.startsWith("../") || relativePath === "..") {
      return undefined;
    }
    return relativePath;
  }

  const relativePath = normalizePath(normalizedInput.replace(/^\.\//, ""));
  if (relativePath === ".." || relativePath.startsWith("../")) {
    return undefined;
  }
  return relativePath;
}

export function coverageRecordId(normalizedFilePath: string): string {
  return `coverage_${sanitizeIdPart(normalizedFilePath) || "root"}`;
}

export function percent(covered: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((covered / total) * 100).toFixed(2));
}
