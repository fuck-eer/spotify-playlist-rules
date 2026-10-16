import type postgres from "postgres";
import { createSql } from "./client";
import { migrate } from "./migrate";

const DEFAULT_TEST_URL = "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";
const APP_TABLES = ["users", "sessions", "rules", "mixes", "mix_rules", "save_runs", "track_cache"];

function testUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL;
}

let migrated: Promise<string[]> | undefined;
let shared: postgres.Sql | undefined;

export async function canReachTestDb(): Promise<boolean> {
  const sql = createSql(testUrl());
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Migrates TEST_DATABASE_URL once per process, then truncates all app tables. */
export async function resetTestDb(): Promise<postgres.Sql> {
  shared ??= createSql(testUrl());
  const sql = shared;
  migrated ??= migrate(sql, { log: () => {} });
  await migrated;
  await sql.unsafe(`truncate ${APP_TABLES.join(", ")} restart identity cascade`);
  return sql;
}

/** Ends the shared test client and forgets it, so the next resetTestDb() starts fresh. */
export async function closeTestDb(): Promise<void> {
  const sql = shared;
  shared = undefined;
  migrated = undefined;
  if (sql) await sql.end({ timeout: 5 });
}

export interface TestUserOverrides {
  id?: string;
  account_id?: string | null;
  display_name?: string | null;
  refresh_token_encrypted?: string;
  scopes?: string;
}

let counter = 0;

export async function insertTestUser(
  sql: postgres.Sql,
  overrides: TestUserOverrides = {},
): Promise<{ id: string }> {
  counter += 1;
  const row = {
    id: overrides.id ?? `test-user-${counter}`,
    account_id: overrides.account_id ?? null,
    display_name: overrides.display_name ?? "Test User",
    refresh_token_encrypted: overrides.refresh_token_encrypted ?? "enc:test",
    scopes: overrides.scopes ?? "playlist-read-private",
  };
  const [u] = await sql<{ id: string }[]>`
    insert into users (id, account_id, display_name, refresh_token_encrypted, scopes, authorized_at)
    values (${row.id}, ${row.account_id}, ${row.display_name}, ${row.refresh_token_encrypted}, ${row.scopes}, now())
    returning id`;
  return { id: u!.id };
}
