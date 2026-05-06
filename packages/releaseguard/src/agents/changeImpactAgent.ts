import {
  findConsumersOfCapability,
  findDefinedCapabilitiesForFile,
} from "../graph/capabilityGraph";
import { CapabilityGraph } from "../graph/types";
import { ChangeImpactAgentOutput, Citation } from "./schemas";

export type ChangeImpactAgentInput = {
  changedFiles: string[];
  graph: CapabilityGraph;
  prTitle?: string;
  prDescription?: string;
};

export interface ChangeImpactAgent {
  analyze(input: ChangeImpactAgentInput): Promise<ChangeImpactAgentOutput>;
}

export class DeterministicChangeImpactAgent implements ChangeImpactAgent {
  async analyze(input: ChangeImpactAgentInput): Promise<ChangeImpactAgentOutput> {
    const affected = new Set<string>();
    const citations: Citation[] = [];
    const rationale: Record<string, string> = {};
    const unresolved_items: ChangeImpactAgentOutput["unresolved_items"] = [];

    for (const filePath of input.changedFiles) {
      const defined = findDefinedCapabilitiesForFile(input.graph, filePath);
      if (defined.length === 0) {
        unresolved_items.push({
          item: filePath,
          reason: "Changed file did not map to a scanned capability.",
        });
        continue;
      }

      for (const capability of defined) {
        affected.add(capability.id);
        rationale[capability.id] = `Changed file ${filePath} defines ${capability.id}.`;
        citations.push({
          source_id: capability.id,
          source_type: "node",
          evidence_ref_index: 0,
          reason: "Changed file maps directly to this capability.",
        });

        for (const consumer of findConsumersOfCapability(input.graph, capability.id)) {
          affected.add(consumer.id);
          rationale[consumer.id] =
            `${consumer.id} consumes changed capability ${capability.id}.`;
          const consumesEdge = Object.values(input.graph.edges).find(
            (edge) =>
              edge.type === "consumes" &&
              edge.source === consumer.id &&
              edge.target === capability.id,
          );
          if (consumesEdge) {
            citations.push({
              source_id: consumesEdge.id,
              source_type: "edge",
              evidence_ref_index: 0,
              reason: "Graph traversal found a consumer of the changed API.",
            });
          }
          citations.push({
            source_id: consumer.id,
            source_type: "node",
            evidence_ref_index: 0,
            reason: "Consumer capability is affected through graph traversal.",
          });
        }
      }
    }

    return {
      affected_capability_ids: [...affected],
      rationale_per_capability: rationale,
      citations,
      unresolved_items,
    };
  }
}

