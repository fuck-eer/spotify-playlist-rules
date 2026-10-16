# 13: Fail stale save runs (heartbeat)

**Status:** done
**Type:** bug
**Refs:** review P1; spec A5, story 46; ticket 12 known limit

## Problem
A run left `running` by a crash or function timeout blocks every later save for that Mix (409 forever, UI polls a run that never ends).

## Decision
- Migration `0003_save_runs_heartbeat.sql`: `save_runs.updated_at timestamptz not null default now()`.
- `updateRun` (and `finishRun`) bump `updated_at = now()`.
- `failStaleRuns(sql, userId, mixId)`: runs with `status='running'` and `updated_at < now() - interval '5 minutes'` become `failed` with "Couldn't create the playlist. Check your connection and retry." and `finished_at = now()`.
- Called before the running check in POST `/api/mixes/[id]/save` and in GET `/api/mixes/[id]/save/[runId]`.

## Tests (write first)
- repo: a run backdated 6 min is failed with the generic message; a run 1 min old is untouched; `updateRun` bumps `updated_at`.
- route: with a backdated running run, POST returns 202 (new run); GET of the stale run returns `failed`.

## Acceptance criteria
- [x] A stale run never blocks saving for more than 5 minutes after its last progress
- [x] All tests pass

## Notes (implementation)
- `updateRun` and `finishRun` now only touch runs that are still `running`, so a zombie save that resumes after being marked stale can't flip it back to succeeded.
- `SAVE_FAILED` moved to `save-runs-repo.ts` (re-exported from `lib/save.ts`).
