import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as playRoute } from "../app/api/mixes/[id]/play/route";
import { GET as getRunRoute } from "../app/api/mixes/[id]/save/[runId]/route";
import { POST as saveRoute } from "../app/api/mixes/[id]/save/route";
import { getSql } from "./db/client";
import { createMix } from "./db/mixes-repo";
import type { SaveRunRow } from "./db/save-runs-repo";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { FAKE_ME } from "./testing/fake-library";
import { installFakeWrites } from "./testing/fake-writes";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const tasks: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => Promise<unknown>) => void tasks.push(fn()) };
});

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("play route", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;
  let mixId: string;
  let release: () => void;

  const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;
  const play = (id = mixId) =>
    playRoute(req(`/api/mixes/${id}/play`, cookie, { method: "POST" }), ctx({ id }));
  const getRun = async (runId: string) =>
    (
      (await (
        await getRunRoute(
          req(`/api/mixes/${mixId}/save/${runId}`, cookie),
          ctx({ id: mixId, runId }),
        )
      ).json()) as { run: SaveRunRow }
    ).run;

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
    installFakeWrites(fake);
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

  it("POST starts a play run (202) and the status endpoint reports its outcome and playlist", async () => {
    const res = await play();
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };
    expect(await getRun(runId)).toMatchObject({ kind: "play", status: "running" });
    release();
    await Promise.all(tasks.splice(0));
    expect(await getRun(runId)).toMatchObject({
      kind: "play",
      status: "succeeded",
      playback: "needs_scopes",
      playlistId: "tgt-1",
    });
  });

  it("is 409 with the running run's id while a Save of the same mix runs", async () => {
    const saving = await saveRoute(
      req(`/api/mixes/${mixId}/save`, cookie, { method: "POST" }),
      ctx({ id: mixId }),
    );
    const { runId } = (await saving.json()) as { runId: string };
    const res = await play();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ runId });
    release();
    await Promise.all(tasks.splice(0));
  });

  it("POST for an unknown mix is 404", async () => {
    const res = await play("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
