import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DELETE as removeRule } from "../app/api/mixes/[id]/rules/[mixRuleId]/route";
import { PUT as putOrder } from "../app/api/mixes/[id]/rules/order/route";
import { GET as listRules, POST as addRule } from "../app/api/mixes/[id]/rules/route";
import { GET as listSongs } from "../app/api/mixes/[id]/songs/route";
import { getSql } from "./db/client";
import type { MixRuleRow } from "./db/mix-rules-repo";
import { createMix } from "./db/mixes-repo";
import { createRule, updateRule } from "./db/rules-repo";
import { canReachTestDb, resetTestDb } from "./db/test-utils";
import { resetEnvCache } from "./env";
import { FAKE_ME } from "./testing/fake-library";
import { req, signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

describe.skipIf(!reachable)("mix rules routes", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let cookie: string;
  let mixId: string;
  let ruleId: string;

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    cookie = await signInFakeUser(sql);
    process.env.MAX_RULES_PER_MIX = "10";
    resetEnvCache();
    mixId = (
      await createMix(sql, FAKE_ME, { name: "Gym", source: { type: "playlist", id: "pl-own", name: "Gym bangers" } }, 1)
    ).id;
    ruleId = (await createRule(sql, FAKE_ME, { kind: "repeat", n: 3 })).id;
  });
  afterAll(async () => {
    await getSql().end();
    await sql.end();
    await fake.close();
    restore();
  });

  const post = (body: unknown) =>
    addRule(req(`/api/mixes/${mixId}/rules`, cookie, { method: "POST", body }), ctx({ id: mixId }));
  async function errCode(res: Response): Promise<string> {
    return ((await res.json()) as { error: { code: string } }).error.code;
  }

  it("songs lists available source tracks, de-duplicated, in source order", async () => {
    const res = await listSongs(req(`/api/mixes/${mixId}/songs`, cookie), ctx({ id: mixId }));
    expect(res.status).toBe(200);
    const { songs } = (await res.json()) as { songs: { name: string; artists: string[] }[] };
    expect(songs.map((s) => s.name)).toEqual(["Echo", "Drift", "Sunrise"]);
  });

  it("adds a rule with a source song and lists it with the song name", async () => {
    const res = await post({ ruleId, trackUri: "spotify:track:drift" });
    expect(res.status).toBe(201);
    const list = await listRules(req(`/api/mixes/${mixId}/rules`, cookie), ctx({ id: mixId }));
    const body = (await list.json()) as { rules: MixRuleRow[]; maxRules: number };
    expect(body.maxRules).toBe(10);
    expect(body.rules).toMatchObject([
      { ruleId, kind: "repeat", n: 3, position: 0, trackUri: "spotify:track:drift", songName: "Drift" },
    ]);
  });

  it("rejects a song that isn't in the source", async () => {
    const res = await post({ ruleId, trackUri: "spotify:track:bassline" });
    expect(res.status).toBe(422);
    expect(await errCode(res)).toBe("song_not_in_source");
  });

  it("returns 409 rule_limit at MAX_RULES_PER_MIX", async () => {
    process.env.MAX_RULES_PER_MIX = "1";
    resetEnvCache();
    expect((await post({ ruleId, trackUri: "spotify:track:echo" })).status).toBe(201);
    const res = await post({ ruleId, trackUri: "spotify:track:drift" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "rule_limit", message: "Up to 1 rules per mix." },
    });
  });

  it("rejects archived rules and unknown mixes", async () => {
    await updateRule(sql, FAKE_ME, ruleId, { archived: true });
    const res = await post({ ruleId, trackUri: "spotify:track:echo" });
    expect(res.status).toBe(422);
    expect(await errCode(res)).toBe("rule_archived");
    const missing = "00000000-0000-0000-0000-000000000000";
    const r404 = await addRule(
      req(`/api/mixes/${missing}/rules`, cookie, { method: "POST", body: { ruleId, trackUri: "spotify:track:echo" } }),
      ctx({ id: missing }),
    );
    expect(r404.status).toBe(404);
  });

  it("reorders with 204, rejects a bad order with 400, and deletes with 204", async () => {
    const a = ((await (await post({ ruleId, trackUri: "spotify:track:echo" })).json()) as { rule: MixRuleRow }).rule;
    const b = ((await (await post({ ruleId, trackUri: "spotify:track:drift" })).json()) as { rule: MixRuleRow }).rule;
    const put = (ids: unknown) =>
      putOrder(req(`/api/mixes/${mixId}/rules/order`, cookie, { method: "PUT", body: { ids } }), ctx({ id: mixId }));
    expect((await put([b.id, a.id])).status).toBe(204);
    const bad = await put([a.id]);
    expect(bad.status).toBe(400);
    expect(await errCode(bad)).toBe("bad_order");
    const del = await removeRule(
      req(`/api/mixes/${mixId}/rules/${b.id}`, cookie, { method: "DELETE" }),
      ctx({ id: mixId, mixRuleId: b.id }),
    );
    expect(del.status).toBe(204);
    const list = (await (await listRules(req(`/api/mixes/${mixId}/rules`, cookie), ctx({ id: mixId }))).json()) as {
      rules: MixRuleRow[];
    };
    expect(list.rules.map((r) => [r.id, r.position])).toEqual([[a.id, 0]]);
  });
});
