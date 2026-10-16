# 15: Scope every save_runs query by user

**Status:** done
**Type:** task
**Refs:** review S1; CODING_STANDARDS §Security

## Decision
`startRun`, `getRunningRun`, `updateRun` and `finishRun` take `userId` and join/filter through `mixes.user_id` (like `getRun`). `startRun` inserts via `insert ... select ... from mixes where id = $mix and user_id = $user` and returns null for a Mix that isn't the user's.

## Tests (write first)
- another user's `startRun` on my Mix returns null; `getRunningRun` for another user is null; `updateRun`/`finishRun` by another user change nothing.

## Acceptance criteria
- [x] No save_runs query runs without a user scope
- [x] All tests pass
