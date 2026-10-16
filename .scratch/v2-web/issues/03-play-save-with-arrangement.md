# 03: Play and Save use the v2 engine with the arrangement

**What to build:** Play (Player playlist) and Save write exactly the v2 `uris`: benched songs and deleted copies never reach Spotify; the Source is pruned first.

**Blocked by:** 02

**Status:** done

**Glossary:** Player playlist, Target playlist, Bench, Rule copy. **ADRs:** 0021, 0022, 0026, 0030.

**Files:** `apps/web/lib/play.ts`, `apps/web/lib/save.ts` (build input from `getArrangement` + `pruneToSource`); `apps/web/lib/preview.ts` (server preview uses the same input; kept for the run status only).

**Acceptance criteria**
- [ ] `lib/play.test.ts` and `lib/save.test.ts`: with a Manual order, a benched song and a deleted every-N copy, the written uris equal the fixture-style expected list; a Repeat with removedPlays writes the lower count; a song deleted from the Source is pruned before writing.
- [ ] Existing Play/Save tests updated for v2 semantics (Originals stay) and green; e2e `play.spec.ts`, `save.spec.ts` green.
