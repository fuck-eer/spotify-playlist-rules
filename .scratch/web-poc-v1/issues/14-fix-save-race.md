# 14: One running save per Mix, enforced by the database

**Status:** done
**Type:** bug
**Refs:** review P2; ticket 12; ADR-0015

## Problem
POST /save is check-then-insert. Two concurrent POSTs can both start a run and write the same Target concurrently.

## Decision
- Migration `0004_save_runs_one_running.sql`: `create unique index save_runs_one_running on save_runs(mix_id) where status = 'running';`
- `startRun` catches 23505, re-reads the running run and reports it; the route returns 409 `save_in_progress` with that `runId`.

## Tests (write first)
- repo: a second `startRun` while one is running reports the existing run id.
- route: two concurrent POSTs → exactly one 202 and one 409 carrying the same runId; only one run row exists.

## Acceptance criteria
- [x] At most one `running` save per Mix, even under concurrency
- [x] All tests pass

## Notes (implementation)
- `startRun` returns `{ ok: true, run } | { ok: false, reason: "not_found" } | { ok: false, reason: "in_progress", runId }`. The route no longer does a separate running check.
- If the winning run finishes between the 23505 and the re-read, the original error is rethrown (500); a retry then succeeds.
