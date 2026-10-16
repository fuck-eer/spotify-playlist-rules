alter table save_runs add column updated_at timestamptz not null default now();
