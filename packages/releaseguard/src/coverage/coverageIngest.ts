import { promises as fs } from "node:fs";
import path from "node:path";
import { parseCobertura } from "./coberturaParser";
import { parseLcov } from "./lcovParser";
import { CoverageProvider, CoverageReport } from "./types";

export async function ingestCoverageFile(input: {
  repoRoot: string;
  coverageFile: string;
  provider?: CoverageProvider;
}): Promise<CoverageReport> {
  const sourcePath = path.resolve(input.repoRoot, input.coverageFile);
  const content = await fs.readFile(sourcePath, "utf8");
  const provider = input.provider ?? detectCoverageProvider(input.coverageFile, content);
  const report =
    provider === "lcov"
      ? parseLcov({ content, repoRoot: input.repoRoot, sourcePath })
      : parseCobertura({ content, repoRoot: input.repoRoot, sourcePath });
  return {
    ...report,
    generated_at: new Date().toISOString(),
  };
}

export async function writeCoverageReport(input: {
  repoRoot: string;
  coverageFile: string;
  provider?: CoverageProvider;
}): Promise<{ report: CoverageReport; outputPath: string }> {
  const report = await ingestCoverageFile(input);
  const outputDir = path.join(input.repoRoot, ".releaseguard", "coverage");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "coverage_report.json");
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, outputPath };
}

export function detectCoverageProvider(
  filePath: string,
  content: string,
): CoverageProvider {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".info") || /^\s*(TN:|SF:)/m.test(content)) {
    return "lcov";
  }
  if (lower.endsWith(".xml") || /<coverage\b/.test(content)) {
    return "cobertura";
  }
  throw new Error(`Unable to detect coverage provider for ${filePath}.`);
}

