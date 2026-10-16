import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/sources/route";
import { getSql } from "./db/client";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("GET /api/sources", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness({ MAX_SOURCE_TRACKS: "5" }));
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("lists Liked first, hides followed playlists, and marks tooLarge over the limit", async () => {
    const res = await GET(req("/api/sources", cookie));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      maxSourceTracks: number;
      sources: { type: string; id: string | null; name: string; tooLarge: boolean }[];
    };
    expect(body.maxSourceTracks).toBe(5);
    expect(body.sources.map((s) => [s.name, s.tooLarge])).toEqual([
      ["Liked Songs", false],
      ["Gym bangers", false],
      ["Road trip", true],
    ]);
    expect(body.sources[0]!.type).toBe("liked");
  });

  it("is 401 without a session", async () => {
    expect((await GET(req("/api/sources", null))).status).toBe(401);
  });
});
