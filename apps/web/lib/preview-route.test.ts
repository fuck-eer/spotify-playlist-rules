import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as preview } from "../app/api/mixes/[id]/preview/route";
import { POST as reshuffle } from "../app/api/mixes/[id]/reshuffle/route";
import { getSql } from "./db/client";
import { createMix, getMix } from "./db/mixes-repo";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import type { PreviewResponse } from "./preview";
import { FAKE_ME } from "./testing/fake-library";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!reachable)("preview and reshuffle routes", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;
  let mixId: string;

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Gym", source: { type: "playlist", id: "pl-own", name: "Gym bangers" } },
        7,
      )
    ).id;
    fake.calls.length = 0;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("GET preview reads Spotify only (no POST/PUT/DELETE to the API)", async () => {
    const res = await preview(req(`/api/mixes/${mixId}/preview`, cookie), ctx(mixId));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PreviewResponse;
    expect(body.summary).toBe("3 tracks · 0 rules applied");
    expect(body.skippedText).toBe("1 song skipped (unavailable)");
    const writes = fake.calls.filter((c) => c.method !== "GET" && c.path !== "/api/token");
    expect(writes).toEqual([]);
  });

  it("GET preview is 404 for someone else's or unknown mix and 401 signed out", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await preview(req(`/api/mixes/${missing}/preview`, cookie), ctx(missing))).status).toBe(
      404,
    );
    expect((await preview(req(`/api/mixes/${mixId}/preview`, null), ctx(mixId))).status).toBe(401);
  });

  it("reshuffle stores and returns a new seed", async () => {
    const res = await reshuffle(
      req(`/api/mixes/${mixId}/reshuffle`, cookie, { method: "POST" }),
      ctx(mixId),
    );
    expect(res.status).toBe(200);
    const { seed } = (await res.json()) as { seed: number };
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 4294967295).toBe(true);
    expect((await getMix(sql, FAKE_ME, mixId))?.shuffleSeed).toBe(seed);
  });
});
