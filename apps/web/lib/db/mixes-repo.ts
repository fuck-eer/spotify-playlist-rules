import type postgres from "postgres";
import { isUuid } from "../validation";

export interface MixSource {
  type: "playlist" | "liked";
  id: string | null;
  name: string;
}

export interface MixRow {
  id: string;
  name: string;
  source: MixSource;
  keepSourceOrder: boolean;
  shuffleSeed: number;
  targetPlaylistId: string | null;
  lastSavedAt: string | null;
  ruleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MixPatch {
  name?: string;
  source?: MixSource;
  keepSourceOrder?: boolean;
  shuffleSeed?: number;
  targetPlaylistId?: string | null;
  lastSavedAt?: string;
  lastSnapshotId?: string;
}

interface DbRow {
  id: string;
  name: string;
  source_type: "playlist" | "liked";
  source_playlist_id: string | null;
  source_name: string;
  keep_source_order: boolean;
  shuffle_seed: string | number;
  target_playlist_id: string | null;
  last_saved_at: Date | null;
  rule_count: number;
  created_at: Date;
  updated_at: Date;
}


function toRow(r: DbRow): MixRow {
  return {
    id: r.id,
    name: r.name,
    source: { type: r.source_type, id: r.source_playlist_id, name: r.source_name },
    keepSourceOrder: r.keep_source_order,
    shuffleSeed: Number(r.shuffle_seed),
    targetPlaylistId: r.target_playlist_id,
    lastSavedAt: r.last_saved_at?.toISOString() ?? null,
    ruleCount: r.rule_count,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function select(sql: postgres.Sql | postgres.TransactionSql, userId: string, id?: string) {
  return sql<DbRow[]>`
    select m.id, m.name, m.source_type, m.source_playlist_id, m.source_name, m.keep_source_order,
      m.shuffle_seed, m.target_playlist_id, m.last_saved_at, m.created_at, m.updated_at,
      (select count(*)::int from mix_rules mr where mr.mix_id = m.id) as rule_count
    from mixes m
    where m.user_id = ${userId} ${id === undefined ? sql`` : sql`and m.id = ${id}`}
    order by m.updated_at desc, m.created_at desc`;
}

export async function listMixes(sql: postgres.Sql, userId: string): Promise<MixRow[]> {
  return (await select(sql, userId)).map(toRow);
}

export async function getMix(
  sql: postgres.Sql,
  userId: string,
  id: string,
): Promise<MixRow | null> {
  if (!isUuid(id)) return null;
  const [r] = await select(sql, userId, id);
  return r ? toRow(r) : null;
}

export async function createMix(
  sql: postgres.Sql,
  userId: string,
  input: { name: string; source: MixSource },
  seed: number,
): Promise<MixRow> {
  const { source } = input;
  const [r] = await sql<{ id: string }[]>`
    insert into mixes (user_id, name, source_type, source_playlist_id, source_name, shuffle_seed)
    values (${userId}, ${input.name}, ${source.type}, ${source.type === "liked" ? null : source.id},
      ${source.name}, ${seed})
    returning id`;
  const row = await getMix(sql, userId, r!.id);
  if (!row) throw new Error("created mix not found");
  return row;
}

/** Changing the source deletes the Mix's rules in the same transaction (rule songs belong to the old source). */
export async function updateMix(
  sql: postgres.Sql,
  userId: string,
  id: string,
  patch: MixPatch,
): Promise<MixRow | null> {
  if (!isUuid(id)) return null;
  return sql.begin(async (tx) => {
    const [cur] = await tx<{ source_type: string; source_playlist_id: string | null }[]>`
      select source_type, source_playlist_id from mixes
      where id = ${id} and user_id = ${userId} for update`;
    if (!cur) return null;
    const set: Record<string, string | number | boolean | Date | null> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.keepSourceOrder !== undefined) set.keep_source_order = patch.keepSourceOrder;
    if (patch.shuffleSeed !== undefined) set.shuffle_seed = patch.shuffleSeed;
    if (patch.targetPlaylistId !== undefined) set.target_playlist_id = patch.targetPlaylistId;
    if (patch.lastSavedAt !== undefined) set.last_saved_at = new Date(patch.lastSavedAt);
    if (patch.lastSnapshotId !== undefined) set.last_snapshot_id = patch.lastSnapshotId;
    if (patch.source) {
      const pid = patch.source.type === "liked" ? null : patch.source.id;
      set.source_type = patch.source.type;
      set.source_playlist_id = pid;
      set.source_name = patch.source.name;
      if (cur.source_type !== patch.source.type || cur.source_playlist_id !== pid) {
        await tx`delete from mix_rules where mix_id = ${id}`;
      }
    }
    set.updated_at = new Date();
    await tx`update mixes set ${tx(set, Object.keys(set))} where id = ${id} and user_id = ${userId}`;
    const [r] = await select(tx, userId, id);
    return r ? toRow(r) : null;
  });
}

export async function deleteMix(sql: postgres.Sql, userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await sql`delete from mixes where id = ${id} and user_id = ${userId}`;
  return res.count > 0;
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
