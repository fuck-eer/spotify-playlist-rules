import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSql } from "./db/client";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { resetEnvCache } from "./env";
import { HttpError } from "./http";
import { readSourceTracks } from "./source-tracks";
import { spotifyForUser } from "./spotify-for-user";
import { FAKE_ME } from "./testing/fake-library";
import { signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("readSourceTracks", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    await signInFakeUser(sql);
    process.env.MAX_SOURCE_TRACKS = "600";
    resetEnvCache();
    fake.calls.length = 0;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("refuses a too-large source with 422 before reading its items", async () => {
    process.env.MAX_SOURCE_TRACKS = "2";
    resetEnvCache();
    const err = await readSourceTracks(sql, spotifyForUser(sql, FAKE_ME), {
      type: "liked",
      id: null,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(422);
    expect((err as HttpError).code).toBe("source_too_large");
    expect(
      fake.calls.some((c) => c.path.endsWith("/me/tracks") && c.query.get("limit") !== "1"),
    ).toBe(false);
  });

  it("reads playlist items (unavailable as null) and upserts track_cache", async () => {
    await sql`insert into track_cache (uri, name, artists, fetched_at)
      values ('spotify:track:echo', 'Old name', '{}', now() - interval '1 day')`;
    const items = await readSourceTracks(sql, spotifyForUser(sql, FAKE_ME), {
      type: "playlist",
      id: "pl-own",
    });
    expect(items.map((t) => t?.name ?? null)).toEqual(["Echo", null, "Drift", "Sunrise"]);
    const rows = await sql<{ uri: string; name: string; artists: string[]; fresh: boolean }[]>`
      select uri, name, artists, fetched_at > now() - interval '1 minute' as fresh
      from track_cache order by uri`;
    expect(rows).toEqual([
      { uri: "spotify:track:drift", name: "Drift", artists: ["Oren"], fresh: true },
      { uri: "spotify:track:echo", name: "Echo", artists: ["Kavi"], fresh: true },
      { uri: "spotify:track:sunrise", name: "Sunrise", artists: ["Kavi"], fresh: true },
    ]);
  });
});
