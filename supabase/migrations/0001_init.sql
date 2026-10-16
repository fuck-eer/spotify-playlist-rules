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
  rule_id uuid not null references rules(id) on delete no action deferrable initially deferred,  -- deviation from ticket "restrict": checked at commit so a user-delete cascade (rules + mixes->mix_rules) succeeds; deleting a referenced rule still fails 23503
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
