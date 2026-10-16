import type postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { canReachTestDb, insertTestUser, resetTestDb } from "../db/test-utils";
import { createSession, destroySession, getSessionUser } from "./session";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[session.test] TEST_DATABASE_URL unreachable: skipping");

describe.skipIf(!reachable)("sessions", () => {
  let sql: postgres.Sql;
  beforeEach(async () => {
    sql = await resetTestDb();
  });
  afterAll(async () => {
    await sql.end();
  });

  it("create then get returns the user", async () => {
    const u = await insertTestUser(sql, { id: "u1", display_name: "Nish" });
    const raw = await createSession(sql, u.id);
    expect(await getSessionUser(sql, raw)).toEqual({ id: "u1", displayName: "Nish" });
  });

  it("returns null for missing, unknown or expired sessions", async () => {
    const u = await insertTestUser(sql);
    const raw = await createSession(sql, u.id);
    expect(await getSessionUser(sql, undefined)).toBeNull();
    expect(await getSessionUser(sql, "nope")).toBeNull();
    await sql`update sessions set expires_at = now() - interval '1 second'`;
    expect(await getSessionUser(sql, raw)).toBeNull();
  });

  it("destroy makes the session unusable", async () => {
    const u = await insertTestUser(sql);
    const raw = await createSession(sql, u.id);
    await destroySession(sql, raw);
    expect(await getSessionUser(sql, raw)).toBeNull();
  });

  it("stores only the hash, never the raw value", async () => {
    const u = await insertTestUser(sql);
    const raw = await createSession(sql, u.id);
    const rows = await sql<{ id_hash: string }[]>`select id_hash from sessions`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id_hash).not.toContain(raw);
    expect(rows[0]!.id_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
