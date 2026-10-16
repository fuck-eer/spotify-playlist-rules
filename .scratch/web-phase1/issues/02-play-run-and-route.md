# 02: Play run, schema and route

**What to build:** `POST /api/mixes/{id}/play` writes the Mix's engine output into the user's Player playlist in a background run and records the Playback outcome, per the spec's Schema, Play run and API decisions.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration `0005_player_playlist.sql`: `users.player_playlist_id`; `save_runs.kind` (default `save`, check), `save_runs.playback` (check, nullable), `save_runs.playlist_id`
- [ ] `SaveRunRow` exposes `kind`, `playback`, `playlistId`; `startRun` takes a kind (default `save`); Save sets `playlistId`
- [ ] `performPlay(sql, userId, mixId, runId, client, { checkDelayMs })` (default 1500): read → build → write to the Player playlist (create if null/missing, store id on user) → outcome logic exactly as spec → succeed. Write failures fail the run with Save's messages
- [ ] Tests (test DB + fake Spotify): create+store; overwrite same id; recreate when missing; written uris equal Save's for the same Mix; `needs_scopes` (no devices call made); `no_device`; `started`; `not_started`; devices 500 → `not_started`, run succeeded; no request ever has a `uris` body on `/me/player/play`
- [ ] Route tests: 202 + run kind `play`; 409 with runId while a Save run is running; 404 for unknown mix; status endpoint returns `playback` and `playlistId`
