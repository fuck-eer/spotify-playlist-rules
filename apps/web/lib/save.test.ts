import { createClient, type SpotifyClient } from "@rulemix/spotify";
import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dbTokenStore } from "./auth/token-store";
import { getSql } from "./db/client";
import { addMixRule } from "./db/mix-rules-repo";
import { createMix, getMix } from "./db/mixes-repo";
import { createRule } from "./db/rules-repo";
import { getRun, startRun } from "./db/save-runs-repo";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { performSave } from "./save";
import { spotifyConfig } from "./spotify-config";
import { FAKE_ME } from "./testing/fake-library";
import { installFakeWrites, type FakeWrites } from "./testing/fake-writes";
import { signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("performSave", () => {
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
  async function save() {
    const started = await startRun(sql, FAKE_ME, mixId);
    if (!started.ok) throw new Error(started.reason);
    const run = started.run;
    await performSave(sql, FAKE_ME, mixId, run.id, client());
    return (await getRun(sql, FAKE_ME, mixId, run.id))!;
  }
  const writeCalls = () => fake.calls.filter((c) => c.method !== "GET" && c.path !== "/api/token");

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    await signInFakeUser(sql);
    writes = installFakeWrites(fake);
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
    const rule = await createRule(sql, FAKE_ME, { kind: "pin_first", n: null });
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

  it("v2: writes the arrangement (Manual order, Bench, deleted copy, Repeat with a removed play), pruned first", async () => {
    const T = (id: string) => `spotify:track:${id}`;
    // "Gym bangers": Echo, a local file, Drift, Sunrise.
    await sql`update mixes set source_type = 'playlist', source_playlist_id = 'pl-own',
      manual_order = ${[T("gone"), T("sunrise"), T("echo"), T("drift")]}::text[],
      bench = ${[T("drift"), T("gone")]}::text[] where id = ${mixId}`;
    const every = await createRule(sql, FAKE_ME, { kind: "every_n", n: 2 });
    const rep = await createRule(sql, FAKE_ME, { kind: "repeat", n: 3 });
    await addMixRule(sql, FAKE_ME, mixId, { ruleId: every.id, trackUri: T("echo") }, 10);
    await addMixRule(sql, FAKE_ME, mixId, { ruleId: rep.id, trackUri: T("echo") }, 10);
    await sql`update mix_rules set deleted_copies = '{1}' where rule_id = ${every.id}`;
    await sql`update mix_rules set removed_plays = 1 where rule_id = ${rep.id}`;
    const run = await save();
    expect(run.status).toBe("succeeded");
    const put = writeCalls().find((c) => c.method === "PUT")!;
    // Line [sunrise, echo]; pin bassline at 0 (not in Source, copy kept), echo copy #1 deleted,
    // echo stack x2.
    expect((put.json as { uris: string[] }).uris).toEqual(
      ["bassline", "sunrise", "echo", "echo"].map(T),
    );
    const [m] = await sql<{ manual_order: string[]; bench: string[] }[]>`
      select manual_order, bench from mixes where id = ${mixId}`;
    expect(m).toEqual({ manual_order: [T("sunrise"), T("echo"), T("drift")], bench: [T("drift")] });
  });

  it("first save creates the private target named after the mix and stores its id", async () => {
    const run = await save();
    expect(run).toMatchObject({
      status: "succeeded",
      phase: "done",
      recreated: false,
      tracksWritten: 3,
    });
    const create = writeCalls().find(
      (c) => c.method === "POST" && c.path.endsWith("/me/playlists"),
    )!;
    expect(create.json).toMatchObject({ name: "Rules: Gym", public: false });
    const put = writeCalls().find((c) => c.method === "PUT")!;
    expect(put.path).toBe("/v1/playlists/tgt-1/items");
    expect((put.json as { uris: string[] }).uris[0]).toBe("spotify:track:bassline");
    const mix = (await getMix(sql, FAKE_ME, mixId))!;
    expect(mix.targetPlaylistId).toBe("tgt-1");
    expect(mix.lastSavedAt).not.toBeNull();
    const [row] = await sql<
      { last_snapshot_id: string }[]
    >`select last_snapshot_id from mixes where id = ${mixId}`;
    expect(row!.last_snapshot_id).toMatch(/^snap-/);
  });

  it("second save reuses the target: no create, PUT to the same id", async () => {
    await save();
    fake.calls.length = 0;
    const run = await save();
    expect(run.recreated).toBe(false);
    expect(writeCalls().some((c) => c.path.endsWith("/me/playlists"))).toBe(false);
    expect(
      writeCalls()
        .filter((c) => c.method === "PUT")
        .map((c) => c.path),
    ).toEqual(["/v1/playlists/tgt-1/items"]);
  });

  it("recreates a target that is gone and stores the new id", async () => {
    await save();
    writes.missing.add("tgt-1");
    const run = await save();
    expect(run.recreated).toBe(true);
    expect((await getMix(sql, FAKE_ME, mixId))!.targetPlaylistId).toBe("tgt-2");
  });

  it("writes 250 tracks as PUT 100 + POST 100 + POST 50 with progress ending at 250/250", async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({
      track: { uri: `spotify:track:t${i}`, name: `T${i}`, type: "track", artists: [{ name: "A" }] },
    }));
    fake.on("GET", /\/me\/tracks$/, () => ({ body: { total: 250, next: null, items } }));
    await sql`delete from mix_rules where mix_id = ${mixId}`;
    const run = await save();
    const sizes = writeCalls()
      .filter((c) => c.path.endsWith("/items"))
      .map((c) => `${c.method} ${(c.json as { uris: string[] }).uris.length}`);
    expect(sizes).toEqual(["PUT 100", "POST 100", "POST 50"]);
    expect(run).toMatchObject({ status: "succeeded", tracksWritten: 250, done: 250, total: 250 });
  });

  it("fails with the sign-in message when the token refresh is refused", async () => {
    fake.on("POST", /^\/api\/token$/, () => ({ status: 400, body: { error: "invalid_grant" } }));
    const run = await save();
    expect(run).toMatchObject({
      status: "failed",
      error: "Spotify access expired. Sign in again.",
    });
    fake.on("POST", /^\/api\/token$/, () => ({
      body: { access_token: "fake-access", expires_in: 3600, scope: "" },
    }));
  });

  it("fails with the generic message on other errors", async () => {
    fake.on("PUT", /\/playlists\/[^/]+\/items$/, () => ({ status: 500, body: {} }));
    const run = await save();
    expect(run).toMatchObject({
      status: "failed",
      error: "Couldn't create the playlist. Check your connection and retry.",
    });
  });

  it("counts a 429 retry and still succeeds", async () => {
    let first = true;
    fake.on("PUT", /\/playlists\/[^/]+\/items$/, () => {
      if (first) {
        first = false;
        return { status: 429, headers: { "retry-after": "1" }, body: {} };
      }
      return { body: { snapshot_id: "snap-x" } };
    });
    const run = await save();
    expect(run).toMatchObject({ status: "succeeded", retries429: 1 });
  });
});
