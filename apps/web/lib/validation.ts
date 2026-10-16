import { MAX_N, MIN_N } from "@rulemix/rules-engine";
import { z } from "zod";

const RuleKindSchema = z.enum(["pin_first", "every_n", "repeat"]);

function nMatchesKind(v: { kind: string; n: number | null }): boolean {
  return v.kind === "pin_first" ? v.n === null : v.n !== null;
}
const N_MESSAGE = `n must be null for pin_first and an integer ${MIN_N}–${MAX_N} otherwise`;

/** A Rule template: no song (songs are bound per Mix). */
export const RuleInputSchema = z
  .object({ kind: RuleKindSchema, n: z.number().int().min(MIN_N).max(MAX_N).nullable() })
  .strict()
  .refine(nMatchesKind, { message: N_MESSAGE, path: ["n"] });

export type RuleInput = z.infer<typeof RuleInputSchema>;

export const RulePatchSchema = z
  .object({
    kind: RuleKindSchema.optional(),
    n: z.number().int().min(MIN_N).max(MAX_N).nullable().optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict();

/** Checks a patch merged onto the current rule still forms a valid Rule. */
export function mergedRuleIsValid(
  current: { kind: string; n: number | null },
  patch: { kind?: string | undefined; n?: number | null | undefined },
): boolean {
  return nMatchesKind({
    kind: patch.kind ?? current.kind,
    n: patch.n !== undefined ? patch.n : current.n,
  });
}
