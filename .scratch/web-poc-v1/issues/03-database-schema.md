# 03: Database schema, migrations, local/test DB

**Status:** done
**Type:** task
**Blocked by:** 01
**Glossary terms:** Rule, Mix, Rule Set, Target playlist, Seed, Archive
**Refs:** spec "Data model", Confirmed decisions A3, A4, A5; ADR-0008, 0015, 0016, 0017
**Env vars:** `DATABASE_URL`, `TEST_DATABASE_URL`

## What to build
The full v1 Postgres schema as SQL migrations, a migration runner, and a typed database client with test helpers. Everything runs locally in Docker; no hosted Supabase project is created.

## Files
- `supabase/migrations/0001_init.sql`
- `scripts/migrate.ts`:
  - reads `process.env.DATABASE_URL` (or the `--url` arg);
  - creates `schema_migrations(version text primary key, applied_at timestamptz default now())` if it is missing;
  - applies `supabase/migrations/*.sql` in filename order, each inside its own transaction, skipping versions already applied;
  - logs filenames only.
- `apps/web/lib/db/client.ts`:
  - `export function getSql(): postgres.Sql` (a singleton built from `env.DATABASE_URL`);
  - `export function createSql(url: string): postgres.Sql`.
  
  Add the dependency `postgres@^3`.
- `apps/web/lib/db/test-utils.ts`:
  - `export async function resetTestDb(): Promise<postgres.Sql>` runs the migrations against `TEST_DATABASE_URL` once per process, then truncates all app tables with `RESTART IDENTITY CASCADE`;
  - `export async function insertTestUser(sql, overrides?): Promise<{ id: string }>`.
- `apps/web/lib/env.ts`: zod schema for every env var in CODING_STANDARDS.md.
  - `MAX_RULES_PER_MIX` is coerced to a number, default 10, min 1.
  - `MAX_SOURCE_TRACKS` is coerced to a number, default 600, min 1.
  - URL vars get defaults as in the table.
  - Export `export function env(): Env`, parsed lazily and cached. Tests can call `resetEnvCache()`.
- `apps/web/lib/db/schema.test.ts`

## Schema (exact, 0001_init.sql)
```sql
create extension if not exists pgcrypto;
create table users (
  id text primary key,                         -- Spotify /me id (A3)
  account_id text,                             -- /me account_id if present (A3)
  display_name text,
  refresh_token_encrypted text not null,
  access_token text, access_token_expires_at timestamptz,
  scopes text not null,
  authorized_at timestamptz not null,
  created_at timestamptz not null default now());
create table sessions (
  id_hash text primary key,                    -- sha256 hex of the cookie value
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now());
create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('pin_first','every_n','repeat')),
  n int check ((kind='pin_first' and n is null) or (kind<>'pin_first' and n between 2 and 10)),
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table mixes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  source_type text not null check (source_type in ('playlist','liked')),
  source_playlist_id text,
  check ((source_type='liked' and source_playlist_id is null) or (source_type='playlist' and source_playlist_id is not null)),
  keep_source_order boolean not null default false,
  shuffle_seed bigint not null check (shuffle_seed between 0 and 4294967295),
  target_playlist_id text,
  last_saved_at timestamptz, last_snapshot_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table mix_rules (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references mixes(id) on delete cascade,
  rule_id uuid not null references rules(id) on delete restrict,
  position int not null check (position >= 0),
  track_uri text not null check (track_uri like 'spotify:track:%'),
  unique (mix_id, position) deferrable initially deferred);
create table save_runs (
  id uuid primary key default gen_random_uuid(),
  mix_id uuid not null references mixes(id) on delete cascade,
  status text not null check (status in ('running','succeeded','failed')) default 'running',
  phase text not null check (phase in ('reading','writing','done')) default 'reading',
  done int not null default 0, total int not null default 0,
  tracks_written int not null default 0,
  recreated boolean not null default false,
  retries_429 int not null default 0,
  error text,
  started_at timestamptz not null default now(), finished_at timestamptz);
create table track_cache (
  uri text primary key, name text not null, artists text[] not null,
  fetched_at timestamptz not null default now());
create index on rules(user_id); create index on mixes(user_id); create index on mix_rules(mix_id); create index on mix_rules(rule_id); create index on save_runs(mix_id, started_at desc);
alter table users enable row level security; alter table sessions enable row level security; alter table rules enable row level security;
alter table mixes enable row level security; alter table mix_rules enable row level security; alter table save_runs enable row level security; alter table track_cache enable row level security;
-- No policies: only the server (table owner / service role) accesses data (A4).
```

## Tests (write first; run against TEST_DATABASE_URL)
`schema.test.ts`:
- the migrations apply twice without error (idempotent runner);
- deleting a rule that is referenced by `mix_rules` raises a foreign-key violation (error code `23503`);
- `rules` rejects `pin_first` with n=3, and `every_n` with n=1 or n=11;
- `mixes` rejects `liked` with a playlist id, and `playlist` without one;
- `mix_rules` rejects a non-`spotify:track:` uri;
- swapping two positions inside one transaction succeeds (the deferred unique constraint);
- deleting a user cascades to rules, mixes, mix_rules and sessions;
- RLS is enabled on all 7 tables (`pg_class.relrowsecurity`).

`env.test.ts`:
- the defaults for `MAX_RULES_PER_MIX` (10) and `MAX_SOURCE_TRACKS` (600);
- a missing `TOKEN_ENCRYPTION_KEY` throws when `env()` is called.

## Acceptance criteria
- [x] `docker compose up -d db && pnpm db:migrate` succeeds on a fresh database
- [x] All tests pass (they skip with a clear message if TEST_DATABASE_URL is unreachable; CI runs the db service)
- [x] No hosted Supabase or paid resources created

## Notes (done)
- `mix_rules.rule_id` FK is `on delete no action deferrable initially deferred` instead of `on delete restrict`: with restrict (and with immediate no action), deleting a user fails because the users->rules cascade is checked before users->mixes->mix_rules finishes. Deleting a referenced rule still raises 23503 (at commit).
- Migration runner core lives in `apps/web/lib/db/migrate.ts` (shared by `scripts/migrate.ts` and `test-utils.ts`).
- Test-utils add `canReachTestDb()` for the skip-if-unreachable behaviour.
- The dev box runs Postgres 16 natively (no Docker); see README.
