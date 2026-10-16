# 16: Explicit closeTestDb() instead of the sql.end monkey-patch

**Status:** done
**Type:** task
**Refs:** review S2

## Decision
`lib/db/test-utils.ts` exports `closeTestDb()`, which ends the shared client and clears the cached client and migration promise. `resetTestDb` no longer patches `sql.end`. Every DB test file calls `closeTestDb()` in `afterAll` instead of `sql.end()`.

## Tests (write first)
- `test-utils.test.ts`: after `closeTestDb()`, `resetTestDb()` returns a fresh, working client; `sql.end` on the returned client is the driver's own.

## Acceptance criteria
- [x] No monkey-patching in test utils; all DB tests pass
