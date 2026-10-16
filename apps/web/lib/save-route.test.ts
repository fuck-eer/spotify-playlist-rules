import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRunRoute } from "../app/api/mixes/[id]/save/[runId]/route";
import { POST as saveRoute } from "../app/api/mixes/[id]/save/route";
import { createSession } from "./auth/session";
import { getSql } from "./db/client";
import { createMix } from "./db/mixes-repo";
import type { SaveRunRow } from "./db/save-runs-repo";
import { canReachTestDb, insertTestUser, resetTestDb } from "./db/test-utils";
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
  const post = () => saveRoute(req(`/api/mixes/${mixId}/save`, cookie, { method: "POST" }), ctx({ id: mixId }));

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
      await createMix(sql, FAKE_ME, { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } }, 1)
    ).id;
  });
  afterAll(async () => {
    await getSql().end();
    await sql.end();
    await fake.close();
    restore();
  });

  it("POST starts a run (202), a second POST while running is 409, and GET follows it to succeeded", async () => {
    const res = await post();
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };

    const again = await post();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: "save_in_progress" }, runId });

    const running = await getRunRoute(
      req(`/api/mixes/${mixId}/save/${runId}`, cookie),
      ctx({ id: mixId, runId }),
    );
    expect(((await running.json()) as { run: SaveRunRow }).run.status).toBe("running");

    release();
    await Promise.all(tasks.splice(0));
    const done = await getRunRoute(req(`/api/mixes/${mixId}/save/${runId}`, cookie), ctx({ id: mixId, runId }));
    expect(((await done.json()) as { run: SaveRunRow }).run).toMatchObject({ status: "succeeded", tracksWritten: 3 });
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
    const res = await saveRoute(req(`/api/mixes/${missing}/save`, cookie, { method: "POST" }), ctx({ id: missing }));
    expect(res.status).toBe(404);
  });
});
