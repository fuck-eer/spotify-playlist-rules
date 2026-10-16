import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET as getOne, PATCH } from "../app/api/mixes/[id]/route";
import { GET as list, POST } from "../app/api/mixes/route";
import { getSql } from "./db/client";
import type { MixRow } from "./db/mixes-repo";
import { canReachTestDb, resetTestDb } from "./db/test-utils";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!reachable)("mixes routes", () => {
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
    await sql.end();
    await fake.close();
    restore();
  });

  async function create(body: unknown): Promise<Response> {
    return POST(req("/api/mixes", cookie, { method: "POST", body }));
  }

  it("rejects an oversized source with source_too_large and the exact message", async () => {
    const res = await create({ name: "Road", source: { type: "playlist", id: "pl-collab" } });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "source_too_large",
        message: "This source has 9 songs. rulemix handles up to 5.",
      },
    });
  });

  it("rejects a followed playlist with source_not_allowed", async () => {
    const res = await create({ name: "Hits", source: { type: "playlist", id: "pl-followed" } });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "source_not_allowed",
    );
  });

  it("rejects an invalid body with 400", async () => {
    expect((await create({ name: "", source: { type: "liked" } })).status).toBe(400);
  });

  it("creates, lists, renames and deletes a mix", async () => {
    const res = await create({ name: "Gym", source: { type: "playlist", id: "pl-own" } });
    expect(res.status).toBe(201);
    const { mix } = (await res.json()) as { mix: MixRow };
    expect(mix.source).toEqual({ type: "playlist", id: "pl-own", name: "Gym bangers" });
    expect(Number.isInteger(mix.shuffleSeed)).toBe(true);
    expect(mix.shuffleSeed).toBeGreaterThanOrEqual(0);
    expect(mix.shuffleSeed).toBeLessThanOrEqual(4294967295);

    const l = (await (await list(req("/api/mixes", cookie))).json()) as { mixes: MixRow[] };
    expect(l.mixes.map((m) => m.id)).toEqual([mix.id]);

    const p = await PATCH(
      req(`/api/mixes/${mix.id}`, cookie, { method: "PATCH", body: { name: "Gym 2" } }),
      ctx(mix.id),
    );
    expect(p.status).toBe(200);
    expect(((await p.json()) as { mix: MixRow }).mix.name).toBe("Gym 2");

    const big = await PATCH(
      req(`/api/mixes/${mix.id}`, cookie, {
        method: "PATCH",
        body: { source: { type: "playlist", id: "pl-collab" } },
      }),
      ctx(mix.id),
    );
    expect(big.status).toBe(422);

    const d = await DELETE(req(`/api/mixes/${mix.id}`, cookie, { method: "DELETE" }), ctx(mix.id));
    expect(d.status).toBe(204);
    expect(fake.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect((await getOne(req(`/api/mixes/${mix.id}`, cookie), ctx(mix.id))).status).toBe(404);
  });

  it("creates from Liked Songs", async () => {
    const res = await create({ name: "Late drive", source: { type: "liked", id: null } });
    expect(res.status).toBe(201);
    const { mix } = (await res.json()) as { mix: MixRow };
    expect(mix.source).toEqual({ type: "liked", id: null, name: "Liked Songs" });
  });
});
