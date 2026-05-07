export type CoverageProvider = "lcov" | "cobertura";

export type EvidenceStrength =
  | "suite_file_coverage"
  | "line_coverage"
  | "unknown";

export type CoverageRecord = {
  id: string;
  file_path: string;
  normalized_file_path: string;
  covered_lines: number[];
  uncovered_lines: number[];
  line_coverage_percent: number;
  statement_coverage_percent?: number;
  branch_coverage_percent?: number;
  test_file_paths?: string[];
  evidence_strength: EvidenceStrength;
};

export type CoverageReport = {
  provider: CoverageProvider;
  file_count: number;
  covered_file_count: number;
  records: CoverageRecord[];
  source_path: string;
  generated_at?: string;
};

export type CoverageEvidence = {
  capability_id?: string;
  file_path: string;
  coverage_record_id: string;
  evidence_type: "coverage_file_evidence";
  evidence_strength: EvidenceStrength;
  line_coverage_percent: number;
  summary: string;
  limitations: string[];
};

