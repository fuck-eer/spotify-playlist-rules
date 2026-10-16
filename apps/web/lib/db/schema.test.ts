import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./migrate";
import { canReachTestDb, insertTestUser, resetTestDb } from "./test-utils";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[schema.test] TEST_DATABASE_URL unreachable: skipping DB tests");

async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

describe.skipIf(!reachable)("database schema", () => {
  let sql: postgres.Sql;
  beforeAll(async () => {
    sql = await resetTestDb();
  });
  beforeEach(async () => {
    sql = await resetTestDb();
  });
  afterAll(async () => {
    await sql.end();
  });

  async function rule(userId: string, kind = "every_n", n: number | null = 3) {
    const [r] = await sql<{ id: string }[]>`
      insert into rules (user_id, kind, n) values (${userId}, ${kind}, ${n}) returning id`;
    return r!.id;
  }
  async function mix(userId: string) {
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, shuffle_seed) values (${userId}, 'm', 'liked', 1) returning id`;
    return m!.id;
  }

  it("applies migrations twice without error", async () => {
    await migrate(sql, { log: () => {} });
    await migrate(sql, { log: () => {} });
    const rows = await sql<{ version: string }[]>`select version from schema_migrations`;
    expect(rows.map((r) => r.version)).toContain("0001_init");
  });

  it("refuses to delete a rule referenced by mix_rules (23503)", async () => {
    const { id: u } = await insertTestUser(sql);
    const r = await rule(u);
    const m = await mix(u);
    await sql`insert into mix_rules (mix_id, rule_id, position, track_uri) values (${m}, ${r}, 0, 'spotify:track:a')`;
    expect(await pgCode(sql`delete from rules where id = ${r}`)).toBe("23503");
  });

  it("rejects invalid rule n values", async () => {
    const { id: u } = await insertTestUser(sql);
    expect(await pgCode(rule(u, "pin_first", 3))).toBe("23514");
    expect(await pgCode(rule(u, "every_n", 1))).toBe("23514");
    expect(await pgCode(rule(u, "every_n", 11))).toBe("23514");
    expect(await pgCode(rule(u, "pin_first", null))).toBeUndefined();
  });

  it("enforces mix source consistency", async () => {
    const { id: u } = await insertTestUser(sql);
    expect(
      await pgCode(sql`insert into mixes (user_id, name, source_type, source_playlist_id, shuffle_seed)
        values (${u}, 'm', 'liked', 'pl1', 1)`),
    ).toBe("23514");
    expect(
      await pgCode(sql`insert into mixes (user_id, name, source_type, shuffle_seed)
        values (${u}, 'm', 'playlist', 1)`),
    ).toBe("23514");
  });

  it("rejects a non-spotify:track: uri in mix_rules", async () => {
    const { id: u } = await insertTestUser(sql);
    const r = await rule(u);
    const m = await mix(u);
    expect(
      await pgCode(sql`insert into mix_rules (mix_id, rule_id, position, track_uri)
        values (${m}, ${r}, 0, 'spotify:episode:x')`),
    ).toBe("23514");
  });

  it("allows swapping two positions in one transaction", async () => {
    const { id: u } = await insertTestUser(sql);
    const r = await rule(u);
    const m = await mix(u);
    await sql`insert into mix_rules (mix_id, rule_id, position, track_uri) values
      (${m}, ${r}, 0, 'spotify:track:a'), (${m}, ${r}, 1, 'spotify:track:b')`;
    await sql.begin(async (tx) => {
      await tx`update mix_rules set position = 1 where mix_id = ${m} and track_uri = 'spotify:track:a'`;
      await tx`update mix_rules set position = 0 where mix_id = ${m} and track_uri = 'spotify:track:b'`;
    });
    const rows = await sql<
      { track_uri: string }[]
    >`select track_uri from mix_rules where mix_id = ${m} order by position`;
    expect(rows.map((x) => x.track_uri)).toEqual(["spotify:track:b", "spotify:track:a"]);
  });

  it("cascades a user delete to rules, mixes, mix_rules and sessions", async () => {
    const { id: u } = await insertTestUser(sql);
    const r = await rule(u);
    const m = await mix(u);
    await sql`insert into mix_rules (mix_id, rule_id, position, track_uri) values (${m}, ${r}, 0, 'spotify:track:a')`;
    await sql`insert into sessions (id_hash, user_id, expires_at) values ('h', ${u}, now() + interval '1 day')`;
    await sql`delete from users where id = ${u}`;
    for (const t of ["rules", "mixes", "mix_rules", "sessions"]) {
      const [c] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(t)}`;
      expect(c!.n, t).toBe(0);
    }
  });

  it("enables RLS on all 7 tables", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class
      where relname in ('users','sessions','rules','mixes','mix_rules','save_runs','track_cache') and relkind = 'r'`;
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
