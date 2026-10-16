import type postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { canReachTestDb, closeTestDb, insertTestUser, resetTestDb } from "./test-utils";
import { createMix, deleteMix, getMix, listMixes, randomSeed, updateMix } from "./mixes-repo";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[mixes-repo.test] TEST_DATABASE_URL unreachable: skipping");

const LIKED = { type: "liked" as const, id: null, name: "Liked Songs" };
const GYM = { type: "playlist" as const, id: "pl-gym", name: "Gym bangers" };

async function addRule(sql: postgres.Sql, userId: string, mixId: string, position: number) {
  const [r] = await sql<{ id: string }[]>`
    insert into rules (user_id, kind, n) values (${userId}, 'repeat', 3) returning id`;
  await sql`insert into mix_rules (mix_id, rule_id, position, track_uri)
    values (${mixId}, ${r!.id}, ${position}, 'spotify:track:abc')`;
}

describe.skipIf(!reachable)("mixes repo", () => {
  let sql: postgres.Sql;
  let user: string;

  beforeEach(async () => {
    sql = await resetTestDb();
    user = (await insertTestUser(sql)).id;
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it("creates a mix with the given seed and lists newest-updated first", async () => {
    const a = await createMix(sql, user, { name: "Gym", source: GYM }, 4294967295);
    expect(a.shuffleSeed).toBe(4294967295);
    expect(a.source).toEqual(GYM);
    expect(a.keepSourceOrder).toBe(false);
    expect(a.targetPlaylistId).toBeNull();
    expect(a.lastSavedAt).toBeNull();
    expect(a.ruleCount).toBe(0);
    const b = await createMix(sql, user, { name: "Late drive", source: LIKED }, 7);
    expect(b.source).toEqual(LIKED);
    await updateMix(sql, user, a.id, { name: "Gym 2" });
    expect((await listMixes(sql, user)).map((m) => m.name)).toEqual(["Gym 2", "Late drive"]);
    expect((await getMix(sql, user, b.id))?.name).toBe("Late drive");
  });

  it("isolates users", async () => {
    const other = (await insertTestUser(sql)).id;
    const mine = await createMix(sql, user, { name: "Mine", source: LIKED }, 1);
    expect(await listMixes(sql, other)).toEqual([]);
    expect(await getMix(sql, other, mine.id)).toBeNull();
    expect(await updateMix(sql, other, mine.id, { name: "Stolen" })).toBeNull();
    expect(await deleteMix(sql, other, mine.id)).toBe(false);
    expect((await getMix(sql, user, mine.id))?.name).toBe("Mine");
  });

  it("returns null for a malformed id", async () => {
    expect(await getMix(sql, user, "not-a-uuid")).toBeNull();
  });

  it("counts rules and deletes them when the source changes", async () => {
    const m = await createMix(sql, user, { name: "Gym", source: GYM }, 1);
    await addRule(sql, user, m.id, 0);
    await addRule(sql, user, m.id, 1);
    expect((await getMix(sql, user, m.id))?.ruleCount).toBe(2);
    expect((await updateMix(sql, user, m.id, { name: "Gym!" }))?.ruleCount).toBe(2);
    const same = await updateMix(sql, user, m.id, { source: GYM });
    expect(same?.ruleCount).toBe(2);
    const changed = await updateMix(sql, user, m.id, { source: LIKED });
    expect(changed?.source).toEqual(LIKED);
    expect(changed?.ruleCount).toBe(0);
  });

  it("updates save fields", async () => {
    const m = await createMix(sql, user, { name: "Gym", source: GYM }, 1);
    const u = await updateMix(sql, user, m.id, {
      keepSourceOrder: true,
      shuffleSeed: 99,
      targetPlaylistId: "tgt",
      lastSavedAt: "2026-10-16T09:00:00.000Z",
      lastSnapshotId: "snap",
    });
    expect(u).toMatchObject({ keepSourceOrder: true, shuffleSeed: 99, targetPlaylistId: "tgt" });
    expect(u?.lastSavedAt).toBe("2026-10-16T09:00:00.000Z");
  });

  it("delete cascades to mix_rules", async () => {
    const m = await createMix(sql, user, { name: "Gym", source: GYM }, 1);
    await addRule(sql, user, m.id, 0);
    expect(await deleteMix(sql, user, m.id)).toBe(true);
    expect(await getMix(sql, user, m.id)).toBeNull();
    const [row] = await sql<{ n: number }[]>`select count(*)::int n from mix_rules`;
    expect(row!.n).toBe(0);
  });

  it("randomSeed is a uint32", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s) && s >= 0 && s <= 4294967295).toBe(true);
    }
  });
});
