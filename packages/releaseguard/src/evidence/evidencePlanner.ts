import { CapabilityGraph, TestCaseTag } from "../graph/types";
import { EvidencePlan, EvidenceRequirement, MissingEvidence } from "./types";
import { selectExistingTests } from "./existingTestSelector";

const INVALID_DISCOUNT_TAGS: TestCaseTag[] = [
  "invalid_discount",
  "400",
  "error_status",
];

export function planEvidence(input: {
  graph: CapabilityGraph;
  affectedCapabilityIds: string[];
}): EvidencePlan {
  const requirements: EvidenceRequirement[] = [];
  const missingEvidence: MissingEvidence[] = [];
  const selectedEvidence = [];

  for (const capabilityId of input.affectedCapabilityIds) {
    if (capabilityId !== "api_apply_discount") {
      continue;
    }

    const requirement: EvidenceRequirement = {
      id: "req_api_apply_discount_invalid_discount",
      type: "existing_test",
      capabilityId,
      requiredTags: INVALID_DISCOUNT_TAGS,
      description:
        "Invalid discount requests must return HTTP 400 with an error response.",
    };
    requirements.push(requirement);
    const selected = selectExistingTests({
      graph: input.graph,
      capabilityId,
      requirementId: requirement.id,
      requiredTags: requirement.requiredTags,
    });
    selectedEvidence.push(...selected);

    if (selected.length === 0) {
      missingEvidence.push({
        requirementId: requirement.id,
        capabilityId,
        reason:
          "No direct API test had invalid_discount, 400, and error_status tags.",
        requiredTags: requirement.requiredTags,
      });
    }
  }

  return {
    requirements,
    selectedEvidence,
    missingEvidence,
  };
}

