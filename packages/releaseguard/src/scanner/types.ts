import { ConfidenceLevel } from "../graph/types";
import { UnresolvedPatternCategory } from "./unresolvedPatternClassifier";

export type ResolvedCallsite = {
  filePath: string;
  line: number;
  routeId: string;
  apiId: string;
  method: string;
  path: string;
  confidence: ConfidenceLevel;
  confidenceBasis: string;
};

export type UnresolvedCallsite = {
  filePath: string;
  line: number;
  reason: string;
  quote: string;
  confidence: "unresolved";
  pattern?: UnresolvedPatternCategory;
};

export type ScannerCoverage = {
  scannedFiles: string[];
  detectedRoutes: Array<{ id: string; target: string; filePath: string }>;
  detectedApis: Array<{ id: string; target: string; filePath: string }>;
  resolvedCallsites: ResolvedCallsite[];
  unresolvedCallsites: UnresolvedCallsite[];
  confidenceBreakdown: Record<ConfidenceLevel, number>;
  limitations: string[];
};

export type ScannerResult = {
  graphPath: string;
  coveragePath: string;
  coverage: ScannerCoverage;
};
