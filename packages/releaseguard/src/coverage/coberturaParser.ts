import { CoverageRecord, CoverageReport } from "./types";
import {
  coverageRecordId,
  normalizeCoverageFilePath,
  percent,
} from "./pathUtils";

export function parseCobertura(input: {
  content: string;
  repoRoot: string;
  sourcePath: string;
}): CoverageReport {
  const records: CoverageRecord[] = [];
  const classPattern = /<class\b([^>]*)>([\s\S]*?)<\/class>/g;
  let match: RegExpExecArray | null;

  while ((match = classPattern.exec(input.content)) !== null) {
    const attrs = parseAttributes(match[1]);
    const filename = attrs.filename;
    if (!filename) {
      continue;
    }
    const normalizedFilePath = normalizeCoverageFilePath(input.repoRoot, filename);
    if (!normalizedFilePath) {
      continue;
    }
    const coveredLines: number[] = [];
    const uncoveredLines: number[] = [];
    const body = match[2];
    const linePattern = /<line\b([^>]*)\/?>/g;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = linePattern.exec(body)) !== null) {
      const lineAttrs = parseAttributes(lineMatch[1]);
      const number = Number.parseInt(lineAttrs.number ?? "", 10);
      const hits = Number.parseInt(lineAttrs.hits ?? "", 10);
      if (!Number.isFinite(number) || number <= 0) {
        continue;
      }
      if (Number.isFinite(hits) && hits > 0) {
        coveredLines.push(number);
      } else {
        uncoveredLines.push(number);
      }
    }
    const totalLines = coveredLines.length + uncoveredLines.length;
    records.push({
      id: coverageRecordId(normalizedFilePath),
      file_path: filename,
      normalized_file_path: normalizedFilePath,
      covered_lines: uniqueSorted(coveredLines),
      uncovered_lines: uniqueSorted(uncoveredLines),
      line_coverage_percent: percent(coveredLines.length, totalLines),
      evidence_strength: coveredLines.length > 0 ? "line_coverage" : "unknown",
    });
  }

  return {
    provider: "cobertura",
    file_count: records.length,
    covered_file_count: records.filter((record) => record.covered_lines.length > 0)
      .length,
    records,
    source_path: input.sourcePath,
  };
}

function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)=(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(input)) !== null) {
    attrs[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

