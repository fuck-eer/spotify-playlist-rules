import { createClient, type SpotifyClient } from "@rulemix/spotify";
import type { FakeSpotify, FakeRequest } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dbTokenStore } from "./auth/token-store";
import { getSql } from "./db/client";
import { addMixRule } from "./db/mix-rules-repo";
import { createMix } from "./db/mixes-repo";
import { createRule } from "./db/rules-repo";
import { getRun, startRun } from "./db/save-runs-repo";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { performPlay } from "./play";
import { performSave } from "./save";
import { spotifyConfig } from "./spotify-config";
import { FAKE_ME } from "./testing/fake-library";
import { installFakeWrites, type FakeWrites } from "./testing/fake-writes";
import { signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const PLAYBACK = "playlist-read-private user-read-playback-state user-modify-playback-state";

describe.skipIf(!reachable)("performPlay", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let writes: FakeWrites;
  let mixId: string;

  const client = (): SpotifyClient =>
    createClient(
      { ...spotifyConfig(), sleep: () => Promise.resolve() },
      dbTokenStore(sql, FAKE_ME),
    );
  async function play() {
    const started = await startRun(sql, FAKE_ME, mixId, "play");
    if (!started.ok) throw new Error(started.reason);
    await performPlay(sql, FAKE_ME, mixId, started.run.id, client(), { checkDelayMs: 0 });
    return (await getRun(sql, FAKE_ME, mixId, started.run.id))!;
  }
  const playerId = async () =>
    (
      await sql<
        { p: string | null }[]
      >`select player_playlist_id p from users where id = ${FAKE_ME}`
    )[0]!.p;
  const calls = (method: string, suffix: string): FakeRequest[] =>
    fake.calls.filter((c) => c.method === method && c.path.endsWith(suffix));
  const putUris = (): [string, string[]][] =>
    calls("PUT", "/items").map((c) => [c.path, (c.json as { uris: string[] }).uris]);
  const grantPlayback = () => sql`update users set scopes = ${PLAYBACK} where id = ${FAKE_ME}`;
  function devices(list: unknown[]): void {
    fake.on("GET", /\/me\/player\/devices$/, () => ({ body: { devices: list } }));
  }
  function remote(playing: boolean): void {
    fake.on("PUT", /\/me\/player\/shuffle$/, () => ({ status: 204 }));
    fake.on("PUT", /\/me\/player\/play$/, () => ({ status: 204 }));
    fake.on("GET", /\/me\/player\/currently-playing$/, () =>
      playing ? { body: { is_playing: true } } : { status: 204 },
    );
  }

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    await signInFakeUser(sql);
    writes = installFakeWrites(fake);
    devices([]);
    remote(false);
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
    const rule = await createRule(sql, FAKE_ME, { kind: "repeat", n: 2 });
    await addMixRule(
      sql,
      FAKE_ME,
      mixId,
      { ruleId: rule.id, trackUri: "spotify:track:bassline" },
      10,
    );
    fake.calls.length = 0;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("first Play creates the private rulemix player playlist and stores its id on the user", async () => {
    const run = await play();
    expect(run).toMatchObject({ status: "succeeded", kind: "play", playlistId: "tgt-1" });
    expect(calls("POST", "/me/playlists")[0]!.json).toEqual({
      name: "rulemix player",
      public: false,
      description: "Managed by rulemix. Play with shuffle off.",
    });
    expect(await playerId()).toBe("tgt-1");
    const [mix] = await sql<{ t: string | null }[]>`select target_playlist_id t from mixes`;
    expect(mix!.t).toBeNull();
  });

  it("second Play overwrites the same Player playlist", async () => {
    await play();
    fake.calls.length = 0;
    await play();
    expect(calls("POST", "/me/playlists")).toHaveLength(0);
    expect(putUris().map(([p]) => p)).toEqual(["/v1/playlists/tgt-1/items"]);
  });

  it("recreates the Player playlist when it is gone", async () => {
    await play();
    writes.missing.add("tgt-1");
    const run = await play();
    expect(run.playlistId).toBe("tgt-2");
    expect(await playerId()).toBe("tgt-2");
  });

  it("v2: never writes benched songs; a Repeat with a removed play writes the lower count", async () => {
    const T = (id: string) => `spotify:track:${id}`;
    await sql`update mixes set manual_order = ${[T("bassline"), T("sunrise")]}::text[],
      bench = ${[T("sunrise"), T("gone")]}::text[] where id = ${mixId}`;
    await sql`update rules set n = 3 where kind = 'repeat'`;
    await sql`update mix_rules set removed_plays = 1 where mix_id = ${mixId}`;
    expect((await play()).status).toBe("succeeded");
    expect(putUris()[0]![1]).toEqual([T("bassline"), T("bassline")]);
    const [m] = await sql<{ bench: string[] }[]>`select bench from mixes where id = ${mixId}`;
    expect(m!.bench).toEqual([T("sunrise")]);
  });

  it("writes exactly what Save writes, repeats included", async () => {
    await play();
    const played = putUris()[0]![1];
    fake.calls.length = 0;
    const s = await startRun(sql, FAKE_ME, mixId);
    if (!s.ok) throw new Error(s.reason);
    await performSave(sql, FAKE_ME, mixId, s.run.id, client());
    expect(putUris()[0]![1]).toEqual(played);
    expect(played.filter((u) => u === "spotify:track:bassline")).toHaveLength(2);
  });

  it("without playback scopes: needs_scopes and no player calls", async () => {
    const run = await play();
    expect(run.playback).toBe("needs_scopes");
    expect(fake.calls.some((c) => c.path.includes("/me/player"))).toBe(false);
  });

  it("no active device: no_device, nothing started", async () => {
    await grantPlayback();
    devices([{ id: "d1", is_active: false }]);
    const run = await play();
    expect(run).toMatchObject({ status: "succeeded", playback: "no_device" });
    expect(calls("PUT", "/me/player/play")).toHaveLength(0);
  });

  it("active device and playing afterwards: started, with shuffle off and the context", async () => {
    await grantPlayback();
    devices([{ id: "d1", is_active: true }]);
    remote(true);
    const run = await play();
    expect(run.playback).toBe("started");
    expect(calls("PUT", "/me/player/shuffle")[0]!.query.get("state")).toBe("false");
    expect(calls("PUT", "/me/player/play")[0]!.json).toEqual({
      context_uri: "spotify:playlist:tgt-1",
    });
  });

  it("active device but nothing playing afterwards: not_started, no error", async () => {
    await grantPlayback();
    devices([{ id: "d1", is_active: true }]);
    const run = await play();
    expect(run).toMatchObject({ status: "succeeded", playback: "not_started", error: null });
  });

  it("a Spotify error during remote play is not_started and the run still succeeds", async () => {
    await grantPlayback();
    fake.on("GET", /\/me\/player\/devices$/, () => ({ status: 500, body: {} }));
    const run = await play();
    expect(run).toMatchObject({ status: "succeeded", playback: "not_started" });
  });

  it("never sends a uris list to play", async () => {
    await grantPlayback();
    devices([{ id: "d1", is_active: true }]);
    remote(true);
    await play();
    for (const c of calls("PUT", "/me/player/play")) expect(c.json).not.toHaveProperty("uris");
  });

  it("concurrent Plays on two mixes create only one Player playlist", async () => {
    const otherMix = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Run", source: { type: "liked", id: null, name: "Liked Songs" } },
        2,
      )
    ).id;
    // Slow create: without the lock both Plays would see no id and create one each.
    let created = 0;
    fake.on("POST", /\/me\/playlists$/, async () => {
      created += 1;
      await new Promise((r) => setTimeout(r, 100));
      return { status: 201, body: { id: `slow-${created}` } };
    });
    const start = async (id: string) => {
      const s = await startRun(sql, FAKE_ME, id, "play");
      if (!s.ok) throw new Error(s.reason);
      await performPlay(sql, FAKE_ME, id, s.run.id, client(), { checkDelayMs: 0 });
      return (await getRun(sql, FAKE_ME, id, s.run.id))!;
    };
    const [a, b] = await Promise.all([start(mixId), start(otherMix)]);
    expect(created).toBe(1);
    expect(a.playlistId).toBe("slow-1");
    expect(b.playlistId).toBe("slow-1");
    expect(await playerId()).toBe("slow-1");
  });

  it("skips remote play when the run was marked failed (stale) during the write", async () => {
    await grantPlayback();
    devices([{ id: "d1", is_active: true }]);
    remote(true);
    const s = await startRun(sql, FAKE_ME, mixId, "play");
    if (!s.ok) throw new Error(s.reason);
    fake.on("PUT", /\/playlists\/[^/]+\/items$/, async () => {
      // What failStaleRuns does when the poller sees no heartbeat for 5 minutes.
      await sql`update save_runs set status = 'failed', error = 'stale' where id = ${s.run.id}`;
      return { body: { snapshot_id: "snap-x" } };
    });
    await performPlay(sql, FAKE_ME, mixId, s.run.id, client(), { checkDelayMs: 0 });
    expect(calls("PUT", "/me/player/play")).toHaveLength(0);
    expect(fake.calls.some((c) => c.path.includes("/me/player"))).toBe(false);
    expect(await getRun(sql, FAKE_ME, mixId, s.run.id)).toMatchObject({
      status: "failed",
      playback: null,
    });
  });

  it("fails cleanly when the per-user lock can't be taken within the lock timeout", async () => {
    const holder = await sql.reserve();
    try {
      await holder`begin`;
      await holder`select pg_advisory_xact_lock(hashtextextended(${`player:${FAKE_ME}`}, 0))`;
      const s = await startRun(sql, FAKE_ME, mixId, "play");
      if (!s.ok) throw new Error(s.reason);
      await performPlay(sql, FAKE_ME, mixId, s.run.id, client(), {
        checkDelayMs: 0,
        lockTimeoutMs: 200,
      });
      expect(await getRun(sql, FAKE_ME, mixId, s.run.id)).toMatchObject({
        status: "failed",
        error: "Couldn't create the playlist. Check your connection and retry.",
      });
      expect(calls("POST", "/me/playlists")).toHaveLength(0);
    } finally {
      await holder`rollback`;
      holder.release();
    }
  });

  it("a failed write fails the run like Save", async () => {
    fake.on("PUT", /\/playlists\/[^/]+\/items$/, () => ({ status: 500, body: {} }));
    const run = await play();
    expect(run).toMatchObject({
      status: "failed",
      playback: null,
      error: "Couldn't create the playlist. Check your connection and retry.",
    });
  });
});
