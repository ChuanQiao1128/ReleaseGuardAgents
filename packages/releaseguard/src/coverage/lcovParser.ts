import { CoverageRecord, CoverageReport } from "./types";
import {
  coverageRecordId,
  normalizeCoverageFilePath,
  percent,
} from "./pathUtils";

type LcovSection = {
  sourceFile?: string;
  coveredLines: number[];
  uncoveredLines: number[];
  linesFound?: number;
  linesHit?: number;
};

export function parseLcov(input: {
  content: string;
  repoRoot: string;
  sourcePath: string;
}): CoverageReport {
  const records: CoverageRecord[] = [];
  let section = emptySection();

  for (const rawLine of input.content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("SF:")) {
      section.sourceFile = line.slice("SF:".length);
      continue;
    }
    if (line.startsWith("DA:")) {
      const [lineNumberRaw, hitRaw] = line.slice("DA:".length).split(",");
      const lineNumber = Number.parseInt(lineNumberRaw, 10);
      const hits = Number.parseInt(hitRaw, 10);
      if (Number.isFinite(lineNumber) && lineNumber > 0) {
        if (Number.isFinite(hits) && hits > 0) {
          section.coveredLines.push(lineNumber);
        } else {
          section.uncoveredLines.push(lineNumber);
        }
      }
      continue;
    }
    if (line.startsWith("LH:")) {
      section.linesHit = Number.parseInt(line.slice("LH:".length), 10);
      continue;
    }
    if (line.startsWith("LF:")) {
      section.linesFound = Number.parseInt(line.slice("LF:".length), 10);
      continue;
    }
    if (line === "end_of_record") {
      const record = recordFromSection(section, input.repoRoot);
      if (record) {
        records.push(record);
      }
      section = emptySection();
    }
  }

  const trailing = recordFromSection(section, input.repoRoot);
  if (trailing) {
    records.push(trailing);
  }

  return {
    provider: "lcov",
    file_count: records.length,
    covered_file_count: records.filter((record) => record.covered_lines.length > 0)
      .length,
    records,
    source_path: input.sourcePath,
  };
}

function emptySection(): LcovSection {
  return {
    coveredLines: [],
    uncoveredLines: [],
  };
}

function recordFromSection(
  section: LcovSection,
  repoRoot: string,
): CoverageRecord | undefined {
  if (!section.sourceFile) {
    return undefined;
  }
  const normalizedFilePath = normalizeCoverageFilePath(repoRoot, section.sourceFile);
  if (!normalizedFilePath) {
    return undefined;
  }

  const coveredLines = uniqueSorted(section.coveredLines);
  const uncoveredLines = uniqueSorted(section.uncoveredLines);
  const totalLines =
    validCount(section.linesFound) ??
    coveredLines.length + uncoveredLines.length;
  const coveredCount = validCount(section.linesHit) ?? coveredLines.length;
  const lineCoveragePercent = percent(coveredCount, totalLines);

  return {
    id: coverageRecordId(normalizedFilePath),
    file_path: section.sourceFile,
    normalized_file_path: normalizedFilePath,
    covered_lines: coveredLines,
    uncovered_lines: uncoveredLines,
    line_coverage_percent: lineCoveragePercent,
    evidence_strength: coveredLines.length > 0 ? "line_coverage" : "unknown",
  };
}

function validCount(value: number | undefined): number | undefined {
  return Number.isFinite(value) && value !== undefined && value >= 0
    ? value
    : undefined;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

