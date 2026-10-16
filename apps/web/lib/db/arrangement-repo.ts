import type postgres from "postgres";
import { isUuid } from "../validation";

/** A Mix's arrangement (ADR-0028, ADR-0030): Manual order, Bench and deleted copies. */
export interface Arrangement {
  manualOrder: string[] | null;
  bench: string[];
  version: number;
  rules: { id: string; removedPlays: number; deletedCopies: number[] }[];
}
export type ArrangementInput = Arrangement;

export async function getArrangement(
  sql: postgres.Sql | postgres.TransactionSql,
  userId: string,
  mixId: string,
): Promise<Arrangement | null> {
  if (!isUuid(mixId)) return null;
  const [m] = await sql<
    { manual_order: string[] | null; bench: string[]; arrangement_version: number }[]
  >`
    select manual_order, bench, arrangement_version from mixes where id = ${mixId} and user_id = ${userId}`;
  if (!m) return null;
  const rules = await sql<{ id: string; removed_plays: number; deleted_copies: number[] }[]>`
    select id, removed_plays, deleted_copies from mix_rules where mix_id = ${mixId} order by position`;
  return {
    manualOrder: m.manual_order,
    bench: m.bench,
    version: m.arrangement_version,
    rules: rules.map((r) => ({
      id: r.id,
      removedPlays: r.removed_plays,
      deletedCopies: r.deleted_copies,
    })),
  };
}

export type PutResult =
  { ok: true; version: number } | { ok: false; code: "not_found" | "conflict" | "unknown_rule" };

/**
 * One transaction: version check, write mixes + mix_rules, delete Repeat Mix rules whose
 * `n - removed_plays <= 1`, bump version.
 */
export async function putArrangement(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  input: ArrangementInput,
): Promise<PutResult> {
  if (!isUuid(mixId)) return { ok: false, code: "not_found" };
  return sql.begin(async (tx): Promise<PutResult> => {
    const [m] = await tx<{ arrangement_version: number }[]>`
      select arrangement_version from mixes where id = ${mixId} and user_id = ${userId} for update`;
    if (!m) return { ok: false, code: "not_found" };
    if (m.arrangement_version !== input.version) return { ok: false, code: "conflict" };
    const own = await tx<{ id: string }[]>`select id from mix_rules where mix_id = ${mixId}`;
    const ownIds = new Set(own.map((r) => r.id));
    if (input.rules.some((r) => !ownIds.has(r.id))) return { ok: false, code: "unknown_rule" };
    for (const r of input.rules) {
      await tx`update mix_rules set removed_plays = ${r.removedPlays},
        deleted_copies = ${r.deletedCopies}::int[] where id = ${r.id}`;
    }
    const gone = await tx<{ id: string }[]>`
      delete from mix_rules mr using rules r
      where mr.mix_id = ${mixId} and r.id = mr.rule_id and r.kind = 'repeat'
        and r.n - mr.removed_plays <= 1
      returning mr.id`;
    if (gone.length > 0) await renumber(tx, mixId);
    const [u] = await tx<{ arrangement_version: number }[]>`
      update mixes set manual_order = ${input.manualOrder}::text[], bench = ${input.bench}::text[],
        arrangement_version = arrangement_version + 1, updated_at = now()
      where id = ${mixId} returning arrangement_version`;
    return { ok: true, version: u!.arrangement_version };
  });
}

async function renumber(tx: postgres.TransactionSql, mixId: string): Promise<void> {
  const rows = await tx<{ id: string }[]>`
    select id from mix_rules where mix_id = ${mixId} order by position`;
  // (mix_id, position) uniqueness is deferred to commit, so one pass is enough.
  for (const [i, r] of rows.entries()) {
    await tx`update mix_rules set position = ${i} where id = ${r.id}`;
  }
}

/** Source sync: drops URIs no longer in the Source from Manual order and Bench; true if changed. */
export async function pruneToSource(
  sql: postgres.Sql,
  mixId: string,
  availableUris: Set<string>,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [m] = await tx<{ manual_order: string[] | null; bench: string[] }[]>`
      select manual_order, bench from mixes where id = ${mixId} for update`;
    if (!m) return false;
    const order = m.manual_order?.filter((u) => availableUris.has(u)) ?? null;
    const bench = m.bench.filter((u) => availableUris.has(u));
    const changed =
      (m.manual_order?.length ?? 0) !== (order?.length ?? 0) || bench.length !== m.bench.length;
    if (!changed) return false;
    await tx`update mixes set manual_order = ${order}::text[], bench = ${bench}::text[],
      arrangement_version = arrangement_version + 1 where id = ${mixId}`;
    return true;
  });
}

/** Reshuffle (clear Manual order) or Reset to rule order; Bench and deletions kept. */
export async function clearManualOrder(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  newSeed: number | null,
): Promise<{ seed: number; version: number } | null> {
  if (!isUuid(mixId)) return null;
  const [r] = await sql<{ shuffle_seed: string | number; arrangement_version: number }[]>`
    update mixes set manual_order = null,
      shuffle_seed = coalesce(${newSeed}::bigint, shuffle_seed),
      arrangement_version = arrangement_version + 1, updated_at = now()
    where id = ${mixId} and user_id = ${userId}
    returning shuffle_seed, arrangement_version`;
  return r ? { seed: Number(r.shuffle_seed), version: r.arrangement_version } : null;
}
