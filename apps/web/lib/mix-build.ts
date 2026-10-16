import { build, type BuildResult, type SourceItem } from "@rulemix/rules-engine";
import type postgres from "postgres";
import { getArrangement, pruneToSource } from "./db/arrangement-repo";
import type { MixRuleRow } from "./db/mix-rules-repo";
import { listMixRules } from "./db/mix-rules-repo";
import type { MixRow } from "./db/mixes-repo";
import { HttpError } from "./http";

/**
 * The one server-side engine call (Play, Save, Preview): prunes Source-deleted songs from the
 * arrangement (ADR-0028/0030), then builds with Manual order, Bench and deleted copies.
 */
export async function buildForMix(
  sql: postgres.Sql,
  userId: string,
  mix: MixRow,
  source: SourceItem[],
): Promise<{ result: BuildResult; rules: MixRuleRow[] }> {
  const available = new Set<string>();
  for (const t of source) if (t) available.add(t.uri);
  await pruneToSource(sql, mix.id, available);
  const [rules, arrangement] = await Promise.all([
    listMixRules(sql, userId, mix.id),
    getArrangement(sql, userId, mix.id),
  ]);
  if (!arrangement) throw new HttpError(404, "not_found", "That mix doesn't exist.");
  const result = build({
    source,
    rules: rules.map((r) => ({
      id: r.id,
      kind: r.kind,
      n: r.n,
      uri: r.trackUri,
      removedPlays: r.removedPlays,
      deletedCopies: r.deletedCopies,
    })),
    keepSourceOrder: mix.keepSourceOrder,
    seed: mix.shuffleSeed,
    manualOrder: arrangement.manualOrder,
    bench: arrangement.bench,
  });
  return { result, rules };
}
