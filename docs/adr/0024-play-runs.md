# ADR-0024: Play reuses save runs

Status: Accepted (Dev Lead, 2026-10-17)

## Context

Play reads a Source of up to MAX_SOURCE_TRACKS items and writes up to that many, like Save, so it needs the same background run, progress and stale-run handling (spec A5).

## Decision

- `save_runs` gains `kind` (`save` | `play`, default `save`), `playback` (nullable outcome, ADR-0022) and `playlist_id` (the playlist written, nullable).
- Play starts a run with kind `play` via its own endpoint, runs in `after()`, and is polled through the existing run status endpoint every 1 second.
- The existing one-running-run-per-Mix index applies across kinds: a Play while a Save of the same Mix is running (or vice versa) gets 409 with the running run's id, and the browser polls that run.

## Consequences

One write per Mix at a time. No new table or poller.
