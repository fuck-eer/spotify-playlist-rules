-- Phase 1 Play (ADR-0021, ADR-0024)
alter table users add column player_playlist_id text;
alter table save_runs add column kind text not null default 'save' check (kind in ('save','play'));
alter table save_runs add column playback text
  check (playback in ('started','not_started','no_device','needs_scopes'));
alter table save_runs add column playlist_id text;
