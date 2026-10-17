import { NextRequest } from "next/server";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getOne, DELETE as del, PATCH as patch } from "../app/api/rules/[id]/route";
import { GET as list, POST as create } from "../app/api/rules/route";
import { createSession, SESSION_COOKIE } from "./auth/session";
import { createRule } from "./db/rules-repo";
import { canReachTestDb, closeTestDb, insertTestUser, resetTestDb } from "./db/test-utils";
import { useTestEnv } from "./test-env";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[rules-routes.test] TEST_DATABASE_URL unreachable: skipping");

const APP = "http://127.0.0.1:3000";

describe.skipIf(!reachable)("rules routes", () => {
  let sql: postgres.Sql;
  let restore: () => void;
  let userId: string;
  let cookie: string;

  beforeAll(() => {
    restore = useTestEnv({
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test",
    });
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    userId = (await insertTestUser(sql)).id;
    cookie = `${SESSION_COOKIE}=${await createSession(sql, userId)}`;
  });
  afterAll(async () => {
    restore();
    await closeTestDb();
  });

  function req(path: string, method = "GET", body?: unknown, auth = true): NextRequest {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) headers.cookie = cookie;
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers,
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new NextRequest(`${APP}${path}`, init);
  }
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 401 without a session", async () => {
    const res = await list(req("/api/rules", "GET", undefined, false));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("creates a valid rule and lists it", async () => {
    const res = await create(req("/api/rules", "POST", { kind: "every_n", n: 4 }));
    expect(res.status).toBe(201);
    const { rule } = (await res.json()) as { rule: { id: string; kind: string; n: number } };
    expect(rule).toMatchObject({ kind: "every_n", n: 4 });
    const listed = (await (await list(req("/api/rules"))).json()) as { rules: { id: string }[] };
    expect(listed.rules.map((r) => r.id)).toEqual([rule.id]);
  });

  it.each([
    [{ kind: "pin_first", n: 3 }],
    [{ kind: "every_n", n: 11 }],
    [{ kind: "repeat", n: 1 }],
    [{ kind: "every_n" }],
    [{ kind: "shuffle", n: 3 }],
    [{ kind: "every_n", n: 4, trackUri: "spotify:track:x" }],
  ])("rejects invalid input %j with 400 invalid_rule", async (body) => {
    const res = await create(req("/api/rules", "POST", body));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_rule" } });
  });

  it("gets a rule or 404s", async () => {
    const r = await createRule(sql, userId, { kind: "repeat", n: 2 });
    expect(await (await getOne(req(`/api/rules/${r.id}`), ctx(r.id))).json()).toMatchObject({
      rule: { id: r.id },
    });
    const missing = await getOne(req("/api/rules/x"), ctx("00000000-0000-0000-0000-000000000000"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("editing kind/n resets removed plays and deleted copies in Mixes and bumps their version (B1)", async () => {
    const r = await createRule(sql, userId, { kind: "repeat", n: 3 });
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, source_name, shuffle_seed)
      values (${userId}, 'M', 'liked', 'Liked', 1) returning id`;
    await sql`insert into mix_rules (mix_id, rule_id, position, track_uri, removed_plays, deleted_copies)
      values (${m!.id}, ${r.id}, 0, 'spotify:track:a', 1, '{2}')`;
    // A pin/archive-only edit leaves them alone.
    await patch(req(`/api/rules/${r.id}`, "PATCH", { pinned: true }), ctx(r.id));
    let [mr] = await sql<{ removed_plays: number }[]>`select removed_plays from mix_rules`;
    expect(mr!.removed_plays).toBe(1);
    const res = await patch(
      req(`/api/rules/${r.id}`, "PATCH", { kind: "every_n", n: 4 }),
      ctx(r.id),
    );
    expect(res.status).toBe(200);
    [mr] = await sql<{ removed_plays: number; deleted_copies: number[] }[]>`
      select removed_plays, deleted_copies from mix_rules`;
    expect(mr).toMatchObject({ removed_plays: 0, deleted_copies: [] });
    const [v] = await sql<{ arrangement_version: number }[]>`select arrangement_version from mixes`;
    expect(v!.arrangement_version).toBe(1);
  });

  it("archives via PATCH", async () => {
    const r = await createRule(sql, userId, { kind: "repeat", n: 2 });
    const res = await patch(req(`/api/rules/${r.id}`, "PATCH", { archived: true }), ctx(r.id));
    expect(res.status).toBe(200);
    const { rule } = (await res.json()) as { rule: { archivedAt: string | null } };
    expect(rule.archivedAt).not.toBeNull();
  });

  it("rejects a PATCH that makes the rule invalid", async () => {
    const r = await createRule(sql, userId, { kind: "repeat", n: 2 });
    const res = await patch(req(`/api/rules/${r.id}`, "PATCH", { kind: "pin_first" }), ctx(r.id));
    expect(res.status).toBe(400);
  });

  it("DELETE returns 204 when unused and 409 with usedInMixes when used", async () => {
    const free = await createRule(sql, userId, { kind: "pin_first", n: null });
    expect((await del(req(`/api/rules/${free.id}`, "DELETE"), ctx(free.id))).status).toBe(204);

    const used = await createRule(sql, userId, { kind: "every_n", n: 3 });
    for (let i = 0; i < 2; i++) {
      const [m] = await sql<{ id: string }[]>`
        insert into mixes (user_id, name, source_type, shuffle_seed) values (${userId}, 'm', 'liked', 1) returning id`;
      await sql`insert into mix_rules (mix_id, rule_id, position, track_uri) values (${m!.id}, ${used.id}, 0, 'spotify:track:a')`;
    }
    const res = await del(req(`/api/rules/${used.id}`, "DELETE"), ctx(used.id));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "rule_in_use", message: "Used in 2 mixes" },
      usedInMixes: 2,
    });
    const gone = await del(req(`/api/rules/${free.id}`, "DELETE"), ctx(free.id));
    expect(gone.status).toBe(404);
  });
});
