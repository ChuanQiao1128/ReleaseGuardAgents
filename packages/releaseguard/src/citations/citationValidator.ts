import { CapabilityGraph } from "../graph/types";
import {
  changeImpactAgentOutputSchema,
  ChangeImpactAgentOutput,
  hasForbiddenAgentField,
} from "../agents/schemas";

export type CitationValidationResult =
  | { valid: true; output: ChangeImpactAgentOutput; errors: [] }
  | { valid: false; errors: string[] };

export function validateChangeImpactOutput(
  graph: CapabilityGraph,
  output: unknown,
): CitationValidationResult {
  const forbiddenField = hasForbiddenAgentField(output);
  if (forbiddenField) {
    return {
      valid: false,
      errors: [`Forbidden agent output field: ${forbiddenField}`],
    };
  }

  const parsed = changeImpactAgentOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const errors: string[] = [];
  const affected = new Set(parsed.data.affected_capability_ids);
  for (const capabilityId of parsed.data.affected_capability_ids) {
    if (!graph.nodes[capabilityId]) {
      errors.push(`Unknown affected capability ID: ${capabilityId}`);
    }
  }

  for (const citation of parsed.data.citations) {
    if (citation.source_type === "node") {
      const node = graph.nodes[citation.source_id];
      if (!node) {
        errors.push(`Unknown citation node ID: ${citation.source_id}`);
        continue;
      }
      if (
        citation.evidence_ref_index !== undefined &&
        !node.evidenceRefs[citation.evidence_ref_index]
      ) {
        errors.push(`Invalid evidence ref index for node: ${citation.source_id}`);
      }
      if (!affected.has(citation.source_id)) {
        errors.push(
          `Citation node ID is not part of affected graph slice: ${citation.source_id}`,
        );
      }
    } else {
      const edge = graph.edges[citation.source_id];
      if (!edge) {
        errors.push(`Unknown citation edge ID: ${citation.source_id}`);
        continue;
      }
      if (
        citation.evidence_ref_index !== undefined &&
        !edge.evidenceRefs[citation.evidence_ref_index]
      ) {
        errors.push(`Invalid evidence ref index for edge: ${citation.source_id}`);
      }
      if (!affected.has(edge.source) && !affected.has(edge.target)) {
        errors.push(
          `Citation edge ID is not connected to affected graph slice: ${citation.source_id}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, output: parsed.data, errors: [] };
}
