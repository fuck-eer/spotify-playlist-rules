import type postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRule, deleteRule, getRule, listRules, updateRule } from "./rules-repo";
import { canReachTestDb, closeTestDb, insertTestUser, resetTestDb } from "./test-utils";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[rules-repo.test] TEST_DATABASE_URL unreachable: skipping");

describe.skipIf(!reachable)("rules repo", () => {
  let sql: postgres.Sql;
  let u: string;
  beforeEach(async () => {
    sql = await resetTestDb();
    u = (await insertTestUser(sql)).id;
  });
  afterAll(async () => {
    await closeTestDb();
  });

  async function useInMix(ruleId: string, positions = 1): Promise<void> {
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, shuffle_seed) values (${u}, 'm', 'liked', 1) returning id`;
    for (let p = 0; p < positions; p++)
      await sql`insert into mix_rules (mix_id, rule_id, position, track_uri) values (${m!.id}, ${ruleId}, ${p}, 'spotify:track:a')`;
  }

  it("creates, lists and gets rules", async () => {
    const a = await createRule(sql, u, { kind: "pin_first", n: null });
    const b = await createRule(sql, u, { kind: "every_n", n: 4 });
    expect(b).toMatchObject({
      kind: "every_n",
      n: 4,
      pinned: false,
      archivedAt: null,
      usedInMixes: 0,
    });
    expect((await listRules(sql, u)).map((r) => r.id)).toEqual([b.id, a.id]);
    expect(await getRule(sql, u, a.id)).toEqual(a);
  });

  it("orders pinned rules first", async () => {
    const a = await createRule(sql, u, { kind: "pin_first", n: null });
    const b = await createRule(sql, u, { kind: "repeat", n: 2 });
    await updateRule(sql, u, a.id, { pinned: true });
    expect((await listRules(sql, u)).map((r) => r.id)).toEqual([a.id, b.id]);
  });

  it("hides one user's rules from another", async () => {
    const other = (await insertTestUser(sql)).id;
    const r = await createRule(sql, u, { kind: "repeat", n: 3 });
    expect(await listRules(sql, other)).toEqual([]);
    expect(await getRule(sql, other, r.id)).toBeNull();
    expect(await updateRule(sql, other, r.id, { pinned: true })).toBeNull();
    expect(await deleteRule(sql, other, r.id)).toBeNull();
  });

  it("counts distinct mixes using a rule", async () => {
    const r = await createRule(sql, u, { kind: "every_n", n: 3 });
    await useInMix(r.id, 2);
    await useInMix(r.id, 1);
    expect((await getRule(sql, u, r.id))?.usedInMixes).toBe(2);
    expect((await listRules(sql, u))[0]?.usedInMixes).toBe(2);
  });

  it("pins, archives and unarchives", async () => {
    const r = await createRule(sql, u, { kind: "every_n", n: 3 });
    expect((await updateRule(sql, u, r.id, { pinned: true }))?.pinned).toBe(true);
    expect((await updateRule(sql, u, r.id, { archived: true }))?.archivedAt).not.toBeNull();
    expect((await updateRule(sql, u, r.id, { archived: false }))?.archivedAt).toBeNull();
    expect(await updateRule(sql, u, r.id, { kind: "pin_first", n: null })).toMatchObject({
      kind: "pin_first",
      n: null,
    });
  });

  it("deletes an unused rule", async () => {
    const r = await createRule(sql, u, { kind: "every_n", n: 3 });
    expect(await deleteRule(sql, u, r.id)).toEqual({ ok: true });
    expect(await getRule(sql, u, r.id)).toBeNull();
  });

  it("refuses to delete a rule used in mixes", async () => {
    const r = await createRule(sql, u, { kind: "every_n", n: 3 });
    await useInMix(r.id);
    await useInMix(r.id);
    expect(await deleteRule(sql, u, r.id)).toEqual({ ok: false, usedInMixes: 2 });
    expect(await getRule(sql, u, r.id)).not.toBeNull();
  });

  it("returns null for unknown or malformed ids", async () => {
    expect(await getRule(sql, u, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getRule(sql, u, "not-a-uuid")).toBeNull();
  });
});
