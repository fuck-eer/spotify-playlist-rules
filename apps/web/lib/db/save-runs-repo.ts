import type postgres from "postgres";
import { isUuid } from "../validation";

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

/** User-safe copy for a failed save (also used for stale runs). */
export const SAVE_FAILED = "Couldn't create the playlist. Check your connection and retry.";
/** A running save with no progress for this long is treated as dead (crash or timeout). */
export const STALE_RUN_MINUTES = 5;

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

export type StartRunResult =
  | { ok: true; run: SaveRunRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "in_progress"; runId: string };

/**
 * Starts a run on the user's Mix. The partial unique index `save_runs_one_running` allows one
 * running run per Mix, so concurrent starts lose with 23505 and get the winner's id.
 */
export async function startRun(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
): Promise<StartRunResult> {
  if (!isUuid(mixId)) return { ok: false, reason: "not_found" };
  try {
    const [r] = await sql<DbRow[]>`
      insert into save_runs as sr (mix_id)
      select m.id from mixes m where m.id = ${mixId} and m.user_id = ${userId}
      returning ${sql.unsafe(COLS)}`;
    return r ? { ok: true, run: toRow(r) } : { ok: false, reason: "not_found" };
  } catch (e) {
    if ((e as { code?: string }).code !== "23505") throw e;
    const running = await getRunningRun(sql, userId, mixId);
    if (!running) throw e;
    return { ok: false, reason: "in_progress", runId: running.id };
  }
}

export async function getRunningRun(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
): Promise<SaveRunRow | null> {
  if (!isUuid(mixId)) return null;
  const [r] = await sql<DbRow[]>`
    select ${sql.unsafe(COLS)} from save_runs sr
    join mixes m on m.id = sr.mix_id and m.user_id = ${userId}
    where sr.mix_id = ${mixId} and sr.status = 'running'
    order by sr.started_at desc limit 1`;
  return r ? toRow(r) : null;
}

export async function updateRun(
  sql: postgres.Sql,
  userId: string,
  id: string,
  patch: RunPatch,
): Promise<void> {
  const set: Record<string, string | number | boolean> = {};
  if (patch.phase !== undefined) set.phase = patch.phase;
  if (patch.done !== undefined) set.done = patch.done;
  if (patch.total !== undefined) set.total = patch.total;
  if (patch.tracksWritten !== undefined) set.tracks_written = patch.tracksWritten;
  if (patch.recreated !== undefined) set.recreated = patch.recreated;
  if (patch.retries429 !== undefined) set.retries_429 = patch.retries429;
  const cols = Object.keys(set);
  if (cols.length === 0) return;
  // Bumps the heartbeat; finished runs are left alone.
  await sql`
    update save_runs sr set ${sql(set, cols)}, updated_at = now()
    from mixes m
    where sr.id = ${id} and sr.status = 'running' and m.id = sr.mix_id and m.user_id = ${userId}`;
}

export async function finishRun(
  sql: postgres.Sql,
  userId: string,
  id: string,
  result: { status: "succeeded" | "failed"; error?: string },
): Promise<void> {
  await sql`
    update save_runs sr set status = ${result.status}, error = ${result.error ?? null},
      phase = case when ${result.status} = 'succeeded' then 'done' else sr.phase end,
      finished_at = now(), updated_at = now()
    from mixes m
    where sr.id = ${id} and sr.status = 'running' and m.id = sr.mix_id and m.user_id = ${userId}`;
}

/** Marks the Mix's running runs with no heartbeat for STALE_RUN_MINUTES as failed. */
export async function failStaleRuns(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
): Promise<void> {
  if (!isUuid(mixId)) return;
  await sql`
    update save_runs sr set status = 'failed', error = ${SAVE_FAILED},
      finished_at = now(), updated_at = now()
    from mixes m
    where sr.mix_id = ${mixId} and sr.status = 'running'
      and sr.updated_at < now() - make_interval(mins => ${STALE_RUN_MINUTES})
      and m.id = sr.mix_id and m.user_id = ${userId}`;
}

export async function getRun(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
): Promise<SaveRunRow | null> {
  if (!isUuid(mixId) || !isUuid(runId)) return null;
  const [r] = await sql<DbRow[]>`
    select ${sql.unsafe(COLS)} from save_runs sr
    join mixes m on m.id = sr.mix_id and m.user_id = ${userId}
    where sr.id = ${runId} and sr.mix_id = ${mixId}`;
  return r ? toRow(r) : null;
}
