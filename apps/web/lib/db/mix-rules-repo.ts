import type { RuleKind } from "@rulemix/rules-engine";
import type postgres from "postgres";

export interface MixRuleRow {
  id: string;
  ruleId: string;
  kind: RuleKind;
  n: number | null;
  position: number;
  trackUri: string;
  /** From track_cache; null until the Source has been read once. */
  songName: string | null;
}

type Tx = postgres.Sql | postgres.TransactionSql;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DbRow {
  id: string;
  rule_id: string;
  kind: RuleKind;
  n: number | null;
  position: number;
  track_uri: string;
  song_name: string | null;
}

function toRow(r: DbRow): MixRuleRow {
  return { id: r.id, ruleId: r.rule_id, kind: r.kind, n: r.n, position: r.position, trackUri: r.track_uri, songName: r.song_name };
}

function select(sql: Tx, userId: string, mixId: string) {
  return sql<DbRow[]>`
    select mr.id, mr.rule_id, r.kind, r.n, mr.position, mr.track_uri, tc.name as song_name
    from mix_rules mr
    join mixes m on m.id = mr.mix_id and m.user_id = ${userId}
    join rules r on r.id = mr.rule_id
    left join track_cache tc on tc.uri = mr.track_uri
    where mr.mix_id = ${mixId}
    order by mr.position asc`;
}

/** Locks the user's Mix row; false when it isn't theirs. */
async function lockMix(tx: Tx, userId: string, mixId: string): Promise<boolean> {
  const [m] = await tx`select id from mixes where id = ${mixId} and user_id = ${userId} for update`;
  return m !== undefined;
}

async function touch(tx: Tx, mixId: string): Promise<void> {
  await tx`update mixes set updated_at = now() where id = ${mixId}`;
}

export async function listMixRules(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
): Promise<MixRuleRow[]> {
  if (!UUID.test(mixId)) return [];
  return (await select(sql, userId, mixId)).map(toRow);
}

export async function addMixRule(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  input: { ruleId: string; trackUri: string },
  maxRules: number,
): Promise<{ ok: true; row: MixRuleRow } | { ok: false; code: "limit" | "not_found" | "archived" }> {
  if (!UUID.test(mixId) || !UUID.test(input.ruleId)) return { ok: false, code: "not_found" };
  return sql.begin(async (tx) => {
    if (!(await lockMix(tx, userId, mixId))) return { ok: false as const, code: "not_found" as const };
    const [rule] = await tx<{ archived_at: Date | null }[]>`
      select archived_at from rules where id = ${input.ruleId} and user_id = ${userId}`;
    if (!rule) return { ok: false as const, code: "not_found" as const };
    if (rule.archived_at) return { ok: false as const, code: "archived" as const };
    const [{ count } = { count: 0 }] = await tx<{ count: number }[]>`
      select count(*)::int as count from mix_rules where mix_id = ${mixId}`;
    if (count >= maxRules) return { ok: false as const, code: "limit" as const };
    const [ins] = await tx<{ id: string }[]>`
      insert into mix_rules (mix_id, rule_id, position, track_uri)
      values (${mixId}, ${input.ruleId}, ${count}, ${input.trackUri}) returning id`;
    await touch(tx, mixId);
    const row = (await select(tx, userId, mixId)).find((r) => r.id === ins!.id)!;
    return { ok: true as const, row: toRow(row) };
  });
}

/** orderedIds must be a permutation of the Mix's current MixRule ids. */
export async function reorderMixRules(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  orderedIds: string[],
): Promise<boolean> {
  if (!UUID.test(mixId)) return false;
  return sql.begin(async (tx) => {
    if (!(await lockMix(tx, userId, mixId))) return false;
    const current = (await tx<{ id: string }[]>`select id from mix_rules where mix_id = ${mixId}`).map(
      (r) => r.id,
    );
    const want = new Set(orderedIds);
    if (
      want.size !== orderedIds.length ||
      orderedIds.length !== current.length ||
      !current.every((id) => want.has(id))
    )
      return false;
    for (const [i, id] of orderedIds.entries()) {
      await tx`update mix_rules set position = ${i} where id = ${id} and mix_id = ${mixId}`;
    }
    await touch(tx, mixId);
    return true;
  });
}

export async function removeMixRule(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  mixRuleId: string,
): Promise<boolean> {
  if (!UUID.test(mixId) || !UUID.test(mixRuleId)) return false;
  return sql.begin(async (tx) => {
    if (!(await lockMix(tx, userId, mixId))) return false;
    const res = await tx`delete from mix_rules where id = ${mixRuleId} and mix_id = ${mixId}`;
    if (res.count === 0) return false;
    await tx`
      update mix_rules mr set position = o.rn - 1
      from (select id, row_number() over (order by position) as rn from mix_rules where mix_id = ${mixId}) o
      where mr.id = o.id`;
    await touch(tx, mixId);
    return true;
  });
}
