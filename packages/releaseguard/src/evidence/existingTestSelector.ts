import { findTestsForCapability } from "../graph/capabilityGraph";
import { CapabilityGraph, TestCaseTag } from "../graph/types";
import { SelectedEvidence } from "./types";

export function selectExistingTests(input: {
  graph: CapabilityGraph;
  capabilityId: string;
  requirementId: string;
  requiredTags: TestCaseTag[];
}): SelectedEvidence[] {
  const tests = findTestsForCapability(input.graph, input.capabilityId);
  return tests
    .filter((test) => {
      const caseTags = test.metadata.caseTags;
      if (!Array.isArray(caseTags)) {
        return false;
      }
      return input.requiredTags.every((tag) => caseTags.includes(tag));
    })
    .map((test) => ({
      requirementId: input.requirementId,
      capabilityId: input.capabilityId,
      testId: test.id,
      testFile: String(test.metadata.testFile ?? test.filePath),
      coverageDepth: "direct",
      caseTags: test.metadata.caseTags as TestCaseTag[],
    }));
}

