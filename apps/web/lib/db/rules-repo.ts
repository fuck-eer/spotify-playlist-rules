import type { RuleKind } from "@rulemix/rules-engine";
import type postgres from "postgres";
import { isUuid } from "../validation";

export interface RuleRow {
  id: string;
  kind: RuleKind;
  n: number | null;
  pinned: boolean;
  archivedAt: string | null;
  usedInMixes: number;
  createdAt: string;
  updatedAt: string;
}

export interface RulePatch {
  kind?: RuleKind;
  n?: number | null;
  pinned?: boolean;
  archived?: boolean;
}

interface DbRow {
  id: string;
  kind: RuleKind;
  n: number | null;
  pinned: boolean;
  archived_at: Date | null;
  used_in_mixes: number;
  created_at: Date;
  updated_at: Date;
}

function toRow(r: DbRow): RuleRow {
  return {
    id: r.id,
    kind: r.kind,
    n: r.n,
    pinned: r.pinned,
    archivedAt: r.archived_at ? r.archived_at.toISOString() : null,
    usedInMixes: r.used_in_mixes,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function select(sql: postgres.Sql, userId: string, id: string | null) {
  return sql<DbRow[]>`
    select r.id, r.kind, r.n, r.pinned, r.archived_at, r.created_at, r.updated_at,
      (select count(distinct mr.mix_id)::int from mix_rules mr where mr.rule_id = r.id) as used_in_mixes
    from rules r
    where r.user_id = ${userId} ${id === null ? sql`` : sql`and r.id = ${id}`}
    order by r.pinned desc, r.created_at desc, r.id`;
}

export async function listRules(sql: postgres.Sql, userId: string): Promise<RuleRow[]> {
  return (await select(sql, userId, null)).map(toRow);
}

export async function getRule(
  sql: postgres.Sql,
  userId: string,
  id: string,
): Promise<RuleRow | null> {
  if (!isUuid(id)) return null;
  const [r] = await select(sql, userId, id);
  return r ? toRow(r) : null;
}

export async function createRule(
  sql: postgres.Sql,
  userId: string,
  input: { kind: RuleKind; n: number | null },
): Promise<RuleRow> {
  const [r] = await sql<{ id: string }[]>`
    insert into rules (user_id, kind, n) values (${userId}, ${input.kind}, ${input.n}) returning id`;
  const row = await getRule(sql, userId, r!.id);
  if (!row) throw new Error("created rule not found");
  return row;
}

export async function updateRule(
  sql: postgres.Sql,
  userId: string,
  id: string,
  patch: RulePatch,
): Promise<RuleRow | null> {
  if (!isUuid(id)) return null;
  const k = patch.kind ?? null;
  const setN = patch.n !== undefined;
  const p = patch.pinned ?? null;
  const a = patch.archived ?? null;
  const res = await sql`
    update rules set
      kind = coalesce(${k}, kind),
      n = case when ${setN} then ${patch.n ?? null}::int else n end,
      pinned = coalesce(${p}::boolean, pinned),
      archived_at = case when ${a}::boolean is null then archived_at
                         when ${a}::boolean then coalesce(archived_at, now()) else null end,
      updated_at = now()
    where id = ${id} and user_id = ${userId}`;
  if (res.count === 0) return null;
  return getRule(sql, userId, id);
}

export async function deleteRule(
  sql: postgres.Sql,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; usedInMixes: number } | null> {
  const r = await getRule(sql, userId, id);
  if (!r) return null;
  if (r.usedInMixes > 0) return { ok: false, usedInMixes: r.usedInMixes };
  try {
    await sql`delete from rules where id = ${id} and user_id = ${userId}`;
  } catch (e) {
    // Raced with a Mix adding this Rule (FK 23503): report it as in use.
    if ((e as { code?: string }).code === "23503") {
      const again = await getRule(sql, userId, id);
      return { ok: false, usedInMixes: again?.usedInMixes ?? 1 };
    }
    throw e;
  }
  return { ok: true };
}
