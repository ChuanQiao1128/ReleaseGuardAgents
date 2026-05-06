import { z } from "zod";

const forbiddenAgentFields = [
  "decision",
  "should_block",
  "shouldBlock",
  "should_merge",
  "shouldMerge",
  "risk",
  "riskAreas",
  "severity",
  "severity_total",
  "finalStatus",
  "final_status",
] as const;

export const citationSchema = z
  .object({
    source_id: z.string(),
    source_type: z.enum(["node", "edge"]),
    evidence_ref_index: z.number().int().nonnegative().optional(),
    reason: z.string(),
  })
  .strict();
export type Citation = z.infer<typeof citationSchema>;

export const unresolvedItemSchema = z
  .object({
    item: z.string(),
    reason: z.string(),
  })
  .strict();
export type UnresolvedItem = z.infer<typeof unresolvedItemSchema>;

export const changeImpactAgentOutputSchema = z
  .object({
    affected_capability_ids: z.array(z.string()),
    rationale_per_capability: z.record(z.string()),
    citations: z.array(citationSchema),
    unresolved_items: z.array(unresolvedItemSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const field of forbiddenAgentFields) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forbidden agent output field: ${field}`,
        });
      }
    }
  });

export type ChangeImpactAgentOutput = z.infer<
  typeof changeImpactAgentOutputSchema
>;

export function hasForbiddenAgentField(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return forbiddenAgentFields.find((field) =>
    Object.prototype.hasOwnProperty.call(value, field),
  );
}

