import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PUT as putArrangementRoute } from "../app/api/mixes/[id]/arrangement/route";
import { POST as resetOrder } from "../app/api/mixes/[id]/reset-order/route";
import { POST as reshuffle } from "../app/api/mixes/[id]/reshuffle/route";
import { GET as getState } from "../app/api/mixes/[id]/state/route";
import { getSql } from "./db/client";
import { createMix, getMix } from "./db/mixes-repo";
import { canReachTestDb, closeTestDb, insertTestUser, resetTestDb } from "./db/test-utils";
import type { MixState } from "./mix-state";
import { FAKE_ME } from "./testing/fake-library";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const T = (id: string) => `spotify:track:${id}`;

describe.skipIf(!reachable)("arrangement: state, PUT, reshuffle, reset-order", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;
  let mixId: string;

  const state = async () => {
    const res = await getState(req(`/api/mixes/${mixId}/state`, cookie), ctx(mixId));
    expect(res.status).toBe(200);
    return (await res.json()) as MixState;
  };
  const put = (body: unknown, id = mixId, c: string | null = cookie) =>
    putArrangementRoute(req(`/api/mixes/${id}/arrangement`, c, { method: "PUT", body }), ctx(id));
  async function addRule(kind: string, n: number | null, uri: string): Promise<string> {
    const [r] = await sql<{ id: string }[]>`
      insert into rules (user_id, kind, n) values (${FAKE_ME}, ${kind}, ${n}) returning id`;
    const [c] = await sql<
      { n: number }[]
    >`select count(*)::int as n from mix_rules where mix_id = ${mixId}`;
    const [mr] = await sql<{ id: string }[]>`
      insert into mix_rules (mix_id, rule_id, position, track_uri)
      values (${mixId}, ${r!.id}, ${c!.n}, ${uri}) returning id`;
    return mr!.id;
  }

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
    // "Gym bangers": Echo, a local file, Drift, Sunrise.
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "Gym", source: { type: "playlist", id: "pl-own", name: "Gym bangers" } },
        7,
      )
    ).id;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("GET state returns mix, rules, source, tracks with art, and arrangement", async () => {
    const id = await addRule("repeat", 3, T("echo"));
    const s = await state();
    expect(s.mix.id).toBe(mixId);
    expect(s.rules).toMatchObject([
      { id, kind: "repeat", n: 3, removedPlays: 0, deletedCopies: [] },
    ]);
    expect(s.source).toHaveLength(4);
    expect(s.source[1]).toBeNull();
    expect(s.tracks[T("echo")]).toEqual({
      name: "Echo",
      artists: ["Kavi"],
      imageUrl: "https://img.test/echo.jpg",
    });
    expect(s.arrangement).toEqual({ manualOrder: null, bench: [], version: 0 });
  });

  it("prunes URIs deleted from the Source from order and bench and bumps the version", async () => {
    await sql`update mixes set manual_order = ${[T("gone"), T("drift"), T("echo")]}::text[],
      bench = ${[T("gone2"), T("sunrise")]}::text[] where id = ${mixId}`;
    const s = await state();
    expect(s.arrangement).toEqual({
      manualOrder: [T("drift"), T("echo")],
      bench: [T("sunrise")],
      version: 1,
    });
    expect((await state()).arrangement.version).toBe(1);
  });

  it("PUT saves and bumps the version; a stale version is 409 with the current state", async () => {
    const id = await addRule("every_n", 2, T("echo"));
    const body = {
      version: 0,
      manualOrder: [T("drift"), T("echo")],
      bench: [T("sunrise")],
      rules: [{ id, removedPlays: 0, deletedCopies: [1] }],
    };
    const ok = await put(body);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ version: 1 });
    const s = await state();
    expect(s.arrangement).toEqual({ manualOrder: body.manualOrder, bench: body.bench, version: 1 });
    expect(s.rules[0]?.deletedCopies).toEqual([1]);

    const stale = await put({ ...body, bench: [] });
    expect(stale.status).toBe(409);
    const j = (await stale.json()) as { state: MixState };
    expect(j.state.arrangement.bench).toEqual([T("sunrise")]);
  });

  it("PUT is 404 for another user's mix, 422 for a bad URI or a foreign rule, 401 signed out", async () => {
    const { id: other } = await insertTestUser(sql);
    const theirs = (
      await createMix(sql, other, { name: "x", source: { type: "liked", id: null, name: "L" } }, 1)
    ).id;
    const empty = { version: 0, manualOrder: null, bench: [], rules: [] };
    expect((await put(empty, theirs)).status).toBe(404);
    expect((await put({ ...empty, bench: ["spotify:episode:x"] })).status).toBe(422);
    expect(
      (
        await put({
          ...empty,
          rules: [{ id: crypto.randomUUID(), removedPlays: 0, deletedCopies: [] }],
        })
      ).status,
    ).toBe(422);
    expect((await put(empty, mixId, null)).status).toBe(401);
  });

  it("a Repeat reaching one play deletes the Mix rule", async () => {
    const pin = await addRule("pin_first", null, T("drift"));
    const rep = await addRule("repeat", 2, T("echo"));
    const last = await addRule("pin_first", null, T("sunrise"));
    const res = await put({
      version: 0,
      manualOrder: null,
      bench: [],
      rules: [{ id: rep, removedPlays: 1, deletedCopies: [] }],
    });
    expect(res.status).toBe(200);
    const s = await state();
    expect(s.rules.map((r) => [r.id, r.position])).toEqual([
      [pin, 0],
      [last, 1],
    ]);
  });

  it("reshuffle clears the order with a new seed and keeps the bench; reset-order keeps the seed", async () => {
    await sql`update mixes set manual_order = ${[T("drift")]}::text[], bench = ${[T("echo")]}::text[]
      where id = ${mixId}`;
    const r1 = await resetOrder(
      req(`/api/mixes/${mixId}/reset-order`, cookie, { method: "POST" }),
      ctx(mixId),
    );
    expect(r1.status).toBe(200);
    let s = await state();
    expect(s.arrangement.manualOrder).toBeNull();
    expect(s.arrangement.bench).toEqual([T("echo")]);
    expect(s.mix.shuffleSeed).toBe(7);

    await sql`update mixes set manual_order = ${[T("drift")]}::text[] where id = ${mixId}`;
    for (let i = 0; i < 5 && (await getMix(sql, FAKE_ME, mixId))!.shuffleSeed === 7; i++) {
      await reshuffle(req(`/api/mixes/${mixId}/reshuffle`, cookie, { method: "POST" }), ctx(mixId));
    }
    s = await state();
    expect(s.arrangement.manualOrder).toBeNull();
    expect(s.arrangement.bench).toEqual([T("echo")]);
    expect(s.mix.shuffleSeed).not.toBe(7);
  });
});
