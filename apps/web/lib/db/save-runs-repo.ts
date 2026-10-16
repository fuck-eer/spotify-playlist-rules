import type postgres from "postgres";

export interface SaveRunRow {
  id: string;
  mixId: string;
  status: "running" | "succeeded" | "failed";
  phase: "reading" | "writing" | "done";
  done: number;
  total: number;
  tracksWritten: number;
  recreated: boolean;
  retries429: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export type RunPatch = Partial<
  Pick<SaveRunRow, "phase" | "done" | "total" | "tracksWritten" | "recreated" | "retries429">
>;

interface DbRow {
  id: string;
  mix_id: string;
  status: SaveRunRow["status"];
  phase: SaveRunRow["phase"];
  done: number;
  total: number;
  tracks_written: number;
  recreated: boolean;
  retries_429: number;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS =
  "sr.id, sr.mix_id, sr.status, sr.phase, sr.done, sr.total, sr.tracks_written, sr.recreated, sr.retries_429, sr.error, sr.started_at, sr.finished_at";

function toRow(r: DbRow): SaveRunRow {
  return {
    id: r.id,
    mixId: r.mix_id,
    status: r.status,
    phase: r.phase,
    done: r.done,
    total: r.total,
    tracksWritten: r.tracks_written,
    recreated: r.recreated,
    retries429: r.retries_429,
    error: r.error,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
  };
}

export async function startRun(sql: postgres.Sql, mixId: string): Promise<SaveRunRow> {
  const [r] = await sql<DbRow[]>`
    insert into save_runs as sr (mix_id) values (${mixId}) returning ${sql.unsafe(COLS)}`;
  return toRow(r!);
}

export async function getRunningRun(sql: postgres.Sql, mixId: string): Promise<SaveRunRow | null> {
  const [r] = await sql<DbRow[]>`
    select ${sql.unsafe(COLS)} from save_runs sr
    where sr.mix_id = ${mixId} and sr.status = 'running'
    order by sr.started_at desc limit 1`;
  return r ? toRow(r) : null;
}

export async function updateRun(sql: postgres.Sql, id: string, patch: RunPatch): Promise<void> {
  const set: Record<string, string | number | boolean> = {};
  if (patch.phase !== undefined) set.phase = patch.phase;
  if (patch.done !== undefined) set.done = patch.done;
  if (patch.total !== undefined) set.total = patch.total;
  if (patch.tracksWritten !== undefined) set.tracks_written = patch.tracksWritten;
  if (patch.recreated !== undefined) set.recreated = patch.recreated;
  if (patch.retries429 !== undefined) set.retries_429 = patch.retries429;
  const cols = Object.keys(set);
  if (cols.length === 0) return;
  await sql`update save_runs set ${sql(set, cols)} where id = ${id}`;
}

export async function finishRun(
  sql: postgres.Sql,
  id: string,
  result: { status: "succeeded" | "failed"; error?: string },
): Promise<void> {
  await sql`
    update save_runs set status = ${result.status}, error = ${result.error ?? null},
      phase = case when ${result.status} = 'succeeded' then 'done' else phase end,
      finished_at = now()
    where id = ${id}`;
}

export async function getRun(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
): Promise<SaveRunRow | null> {
  if (!UUID.test(mixId) || !UUID.test(runId)) return null;
  const [r] = await sql<DbRow[]>`
    select ${sql.unsafe(COLS)} from save_runs sr
    join mixes m on m.id = sr.mix_id and m.user_id = ${userId}
    where sr.id = ${runId} and sr.mix_id = ${mixId}`;
  return r ? toRow(r) : null;
}
