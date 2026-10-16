import type postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createMix } from "./mixes-repo";
import { finishRun, getRun, getRunningRun, startRun, updateRun } from "./save-runs-repo";
import { canReachTestDb, insertTestUser, resetTestDb } from "./test-utils";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[save-runs-repo.test] TEST_DATABASE_URL unreachable: skipping");

describe.skipIf(!reachable)("save runs repo", () => {
  let sql: postgres.Sql;
  let user: string;
  let mixId: string;

  beforeEach(async () => {
    sql = await resetTestDb();
    user = (await insertTestUser(sql)).id;
    mixId = (
      await createMix(
        sql,
        user,
        { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("runs through its lifecycle", async () => {
    const run = (await startRun(sql, user, mixId))!;
    expect(run).toMatchObject({
      mixId,
      status: "running",
      phase: "reading",
      done: 0,
      total: 0,
      tracksWritten: 0,
      recreated: false,
      retries429: 0,
      error: null,
      finishedAt: null,
    });
    expect((await getRunningRun(sql, user, mixId))?.id).toBe(run.id);

    await updateRun(sql, user, run.id, { phase: "writing", done: 100, total: 250 });
    expect(await getRun(sql, user, mixId, run.id)).toMatchObject({
      phase: "writing",
      done: 100,
      total: 250,
    });

    await updateRun(sql, user, run.id, { tracksWritten: 250, recreated: true, retries429: 1 });
    await finishRun(sql, user, run.id, { status: "succeeded" });
    const done = await getRun(sql, user, mixId, run.id);
    expect(done).toMatchObject({
      status: "succeeded",
      phase: "done",
      tracksWritten: 250,
      recreated: true,
      retries429: 1,
    });
    expect(done?.finishedAt).not.toBeNull();
    expect(await getRunningRun(sql, user, mixId)).toBeNull();
  });

  it("records a failure message", async () => {
    const run = (await startRun(sql, user, mixId))!;
    await finishRun(sql, user, run.id, { status: "failed", error: "Nope." });
    expect(await getRun(sql, user, mixId, run.id)).toMatchObject({
      status: "failed",
      error: "Nope.",
    });
  });

  it("every write and read is scoped to the mix owner", async () => {
    const other = (await insertTestUser(sql)).id;
    expect(await startRun(sql, other, mixId)).toBeNull();
    const run = (await startRun(sql, user, mixId))!;
    expect(await getRunningRun(sql, other, mixId)).toBeNull();
    await updateRun(sql, other, run.id, { phase: "writing", done: 5 });
    await finishRun(sql, other, run.id, { status: "failed", error: "x" });
    expect(await getRun(sql, user, mixId, run.id)).toMatchObject({
      status: "running",
      phase: "reading",
      done: 0,
      error: null,
    });
  });

  it("getRun is scoped to the mix owner and the mix", async () => {
    const run = (await startRun(sql, user, mixId))!;
    const other = (await insertTestUser(sql)).id;
    expect(await getRun(sql, other, mixId, run.id)).toBeNull();
    const otherMix = (
      await createMix(
        sql,
        user,
        { name: "B", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
    expect(await getRun(sql, user, otherMix, run.id)).toBeNull();
    expect(await getRun(sql, user, mixId, "not-a-uuid")).toBeNull();
  });
});
