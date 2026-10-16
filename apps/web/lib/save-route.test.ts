import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRunRoute } from "../app/api/mixes/[id]/save/[runId]/route";
import { POST as saveRoute } from "../app/api/mixes/[id]/save/route";
import { createSession } from "./auth/session";
import { getSql } from "./db/client";
import { createMix } from "./db/mixes-repo";
import type { SaveRunRow } from "./db/save-runs-repo";
import { canReachTestDb, closeTestDb, insertTestUser, resetTestDb } from "./db/test-utils";
import { FAKE_ME } from "./testing/fake-library";
import { installFakeWrites } from "./testing/fake-writes";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

// Outside a Next request there is no after(); run the task in the background instead.
const tasks: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => Promise<unknown>) => void tasks.push(fn()) };
});

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("save routes", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;
  let mixId: string;
  let release: () => void;

  const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;
  const post = () =>
    saveRoute(req(`/api/mixes/${mixId}/save`, cookie, { method: "POST" }), ctx({ id: mixId }));

  /** Waits until the background save is parked on the gated write, then backdates its heartbeat. */
  async function makeStale(runId: string): Promise<void> {
    for (let i = 0; i < 200; i++) {
      const [r] = await sql<{ phase: string }[]>`select phase from save_runs where id = ${runId}`;
      if (r?.phase === "writing") break;
      await new Promise((res) => setTimeout(res, 10));
    }
    await sql`update save_runs set updated_at = now() - interval '6 minutes' where id = ${runId}`;
  }

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
    installFakeWrites(fake);
    // Hold the write until the test releases it, so the run stays "running".
    const gate = new Promise<void>((r) => (release = r));
    fake.on("PUT", /\/playlists\/[^/]+\/items$/, async () => {
      await gate;
      return { body: { snapshot_id: "snap-1" } };
    });
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("POST starts a run (202), a second POST while running is 409, and GET follows it to succeeded", async () => {
    const res = await post();
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };

    const again = await post();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: "run_in_progress" }, runId });

    const running = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${runId}`, cookie),
      ctx({ id: mixId, runId }),
    );
    expect(((await running.json()) as { run: SaveRunRow }).run.status).toBe("running");

    release();
    await Promise.all(tasks.splice(0));
    const done = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${runId}`, cookie),
      ctx({ id: mixId, runId }),
    );
    expect(((await done.json()) as { run: SaveRunRow }).run).toMatchObject({
      status: "succeeded",
      tracksWritten: 2, // v2: duplicate Source songs collapse to one Original
    });
  });

  it("a stale running run no longer blocks: POST starts a new run and GET reports the stale one failed", async () => {
    const { runId: staleId } = (await (await post()).json()) as { runId: string };
    await makeStale(staleId);
    const res = await post();
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };
    expect(runId).not.toBe(staleId);
    const stale = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${staleId}`, cookie),
      ctx({ id: mixId, runId: staleId }),
    );
    expect(((await stale.json()) as { run: SaveRunRow }).run.status).toBe("failed");
    release();
    await Promise.all(tasks.splice(0));
    // The zombie save finishing later must not flip the stale run back to succeeded.
    const after = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${staleId}`, cookie),
      ctx({ id: mixId, runId: staleId }),
    );
    expect(((await after.json()) as { run: SaveRunRow }).run.status).toBe("failed");
  });

  it("GET reports a stale run as failed even without a new POST", async () => {
    const { runId } = (await (await post()).json()) as { runId: string };
    await makeStale(runId);
    const res = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${runId}`, cookie),
      ctx({ id: mixId, runId }),
    );
    expect(((await res.json()) as { run: SaveRunRow }).run).toMatchObject({
      status: "failed",
      error: "Couldn't create the playlist. Check your connection and retry.",
    });
    release();
    await Promise.all(tasks.splice(0));
  });

  it("two concurrent POSTs start exactly one run; the other gets 409 with its id", async () => {
    const results = await Promise.all([post(), post(), post()]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([202, 409, 409]);
    const bodies = (await Promise.all(results.map((r) => r.json()))) as { runId: string }[];
    expect(new Set(bodies.map((b) => b.runId)).size).toBe(1);
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from save_runs`;
    expect(row!.n).toBe(1);
    release();
    await Promise.all(tasks.splice(0));
  });

  it("GET of another user's run is 404", async () => {
    const { runId } = (await (await post()).json()) as { runId: string };
    const other = (await insertTestUser(sql)).id;
    const otherCookie = await createSession(sql, other);
    const res = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${runId}`, otherCookie),
      ctx({ id: mixId, runId }),
    );
    expect(res.status).toBe(404);
    release();
    await Promise.all(tasks.splice(0));
  });

  it("POST for an unknown mix is 404", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    const res = await saveRoute(
      req(`/api/mixes/${missing}/save`, cookie, { method: "POST" }),
      ctx({ id: missing }),
    );
    expect(res.status).toBe(404);
  });
});
