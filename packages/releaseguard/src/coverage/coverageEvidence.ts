import { findDefinedCapabilitiesForFile, normalizePath } from "../graph/capabilityGraph";
import { CapabilityGraph } from "../graph/types";
import { CoverageEvidence, CoverageRecord, CoverageReport } from "./types";

const COVERAGE_LIMITATION =
  "Coverage shows this file was executed by tests, but does not prove the specific business case was asserted.";

export function coverageRecordsByPath(
  report: CoverageReport | undefined,
): Map<string, CoverageRecord> {
  return new Map(
    (report?.records ?? []).map((record) => [
      normalizePath(record.normalized_file_path),
      record,
    ]),
  );
}

export function findCoverageEvidenceForFiles(input: {
  coverageReport?: CoverageReport;
  graph: CapabilityGraph;
  filePaths: string[];
}): CoverageEvidence[] {
  const records = coverageRecordsByPath(input.coverageReport);
  const evidence: CoverageEvidence[] = [];
  for (const filePath of input.filePaths) {
    const normalized = normalizePath(filePath);
    const record = records.get(normalized);
    if (!record) {
      continue;
    }
    const capabilities = findDefinedCapabilitiesForFile(input.graph, normalized);
    if (capabilities.length === 0) {
      evidence.push(makeCoverageEvidence(record));
      continue;
    }
    for (const capability of capabilities) {
      evidence.push(makeCoverageEvidence(record, capability.id));
    }
  }
  return dedupeEvidence(evidence);
}

export function findCoverageEvidenceForCapability(input: {
  coverageReport?: CoverageReport;
  graph: CapabilityGraph;
  capabilityId: string;
}): CoverageEvidence[] {
  const records = coverageRecordsByPath(input.coverageReport);
  const definingFileIds = Object.values(input.graph.edges)
    .filter((edge) => edge.type === "defines" && edge.target === input.capabilityId)
    .map((edge) => edge.source);
  const evidence: CoverageEvidence[] = [];
  for (const fileId of definingFileIds) {
    const fileNode = input.graph.nodes[fileId];
    if (!fileNode?.filePath) {
      continue;
    }
    const record = records.get(normalizePath(fileNode.filePath));
    if (record) {
      evidence.push(makeCoverageEvidence(record, input.capabilityId));
    }
  }
  return dedupeEvidence(evidence);
}

function makeCoverageEvidence(
  record: CoverageRecord,
  capabilityId?: string,
): CoverageEvidence {
  return {
    capability_id: capabilityId,
    file_path: record.normalized_file_path,
    coverage_record_id: record.id,
    evidence_type: "coverage_file_evidence",
    evidence_strength: record.evidence_strength,
    line_coverage_percent: record.line_coverage_percent,
    summary: `${record.normalized_file_path} has ${record.line_coverage_percent.toFixed(2)}% line coverage in ${record.id}.`,
    limitations: [COVERAGE_LIMITATION],
  };
}

function dedupeEvidence(evidence: CoverageEvidence[]): CoverageEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.capability_id ?? "file"}:${item.coverage_record_id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

