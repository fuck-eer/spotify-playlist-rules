import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { canReachTestDb, closeTestDb, resetTestDb } from "./test-utils";

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("test db utils", () => {
  it("closeTestDb ends the shared client and the next reset opens a fresh, working one", async () => {
    const first = await resetTestDb();
    expect(await resetTestDb()).toBe(first);
    await closeTestDb();
    await expect(first`select 1`).rejects.toThrow();
    const second = await resetTestDb();
    expect(second).not.toBe(first);
    const [row] = await second<{ one: number }[]>`select 1 as one`;
    expect(row!.one).toBe(1);
    await closeTestDb();
  });

  it("leaves the driver's own end() in place", async () => {
    const sql = await resetTestDb();
    const fresh = postgres("postgres://unused@127.0.0.1:1/x");
    expect(sql.end.toString()).toBe(fresh.end.toString());
    await fresh.end({ timeout: 0 });
    await closeTestDb();
  });
});
