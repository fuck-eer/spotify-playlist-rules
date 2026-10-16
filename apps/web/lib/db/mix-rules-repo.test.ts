import type postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addMixRule, listMixRules, removeMixRule, reorderMixRules } from "./mix-rules-repo";
import { createMix } from "./mixes-repo";
import { createRule, updateRule } from "./rules-repo";
import { canReachTestDb, insertTestUser, resetTestDb } from "./test-utils";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[mix-rules-repo.test] TEST_DATABASE_URL unreachable: skipping");

const T = (s: string) => `spotify:track:${s}`;

describe.skipIf(!reachable)("mix rules repo", () => {
  let sql: postgres.Sql;
  let user: string;
  let mixId: string;
  let ruleId: string;

  beforeEach(async () => {
    sql = await resetTestDb();
    user = (await insertTestUser(sql)).id;
    mixId = (
      await createMix(
        sql,
        user,
        { name: "Gym", source: { type: "liked", id: null, name: "Liked Songs" } },
        1,
      )
    ).id;
    ruleId = (await createRule(sql, user, { kind: "every_n", n: 4 })).id;
  });
  afterAll(async () => {
    await sql.end();
  });

  async function add(uri: string, max = 10) {
    const r = await addMixRule(sql, user, mixId, { ruleId, trackUri: T(uri) }, max);
    if (!r.ok) throw new Error(r.code);
    return r.row;
  }

  it("appends at positions 0, 1, 2 and joins the rule", async () => {
    await add("a");
    await add("b");
    const c = await add("c");
    expect(c).toMatchObject({ ruleId, kind: "every_n", n: 4, position: 2, trackUri: T("c") });
    expect((await listMixRules(sql, user, mixId)).map((r) => [r.position, r.trackUri])).toEqual([
      [0, T("a")],
      [1, T("b")],
      [2, T("c")],
    ]);
  });

  it("enforces the limit", async () => {
    await add("a", 2);
    await add("b", 2);
    expect(await addMixRule(sql, user, mixId, { ruleId, trackUri: T("c") }, 2)).toEqual({
      ok: false,
      code: "limit",
    });
  });

  it("refuses archived and unknown rules", async () => {
    await updateRule(sql, user, ruleId, { archived: true });
    expect(await addMixRule(sql, user, mixId, { ruleId, trackUri: T("a") }, 10)).toEqual({
      ok: false,
      code: "archived",
    });
    expect(
      await addMixRule(
        sql,
        user,
        mixId,
        { ruleId: "00000000-0000-0000-0000-000000000000", trackUri: T("a") },
        10,
      ),
    ).toEqual({ ok: false, code: "not_found" });
  });

  it("reorders by a permutation only", async () => {
    const a = await add("a");
    const b = await add("b");
    const c = await add("c");
    expect(await reorderMixRules(sql, user, mixId, [c.id, a.id, b.id])).toBe(true);
    expect((await listMixRules(sql, user, mixId)).map((r) => r.trackUri)).toEqual([
      T("c"),
      T("a"),
      T("b"),
    ]);
    expect(await reorderMixRules(sql, user, mixId, [a.id, b.id])).toBe(false);
    expect(await reorderMixRules(sql, user, mixId, [a.id, a.id, b.id])).toBe(false);
  });

  it("remove compacts positions", async () => {
    await add("a");
    const b = await add("b");
    await add("c");
    expect(await removeMixRule(sql, user, mixId, b.id)).toBe(true);
    expect((await listMixRules(sql, user, mixId)).map((r) => [r.position, r.trackUri])).toEqual([
      [0, T("a")],
      [1, T("c")],
    ]);
    expect(await removeMixRule(sql, user, mixId, b.id)).toBe(false);
  });

  it("isolates users", async () => {
    const a = await add("a");
    const other = (await insertTestUser(sql)).id;
    const otherRule = (await createRule(sql, other, { kind: "repeat", n: 2 })).id;
    expect(await listMixRules(sql, other, mixId)).toEqual([]);
    expect(
      await addMixRule(sql, other, mixId, { ruleId: otherRule, trackUri: T("x") }, 10),
    ).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(await addMixRule(sql, user, mixId, { ruleId: otherRule, trackUri: T("x") }, 10)).toEqual(
      {
        ok: false,
        code: "not_found",
      },
    );
    expect(await reorderMixRules(sql, other, mixId, [a.id])).toBe(false);
    expect(await removeMixRule(sql, other, mixId, a.id)).toBe(false);
  });
});
