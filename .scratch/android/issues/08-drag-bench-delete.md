# 08: Drag to reorder, Bench, delete copies, Undo (Android)

**What to build:** long-press drag of Original covers to reorder (Manual order), rule covers spring back, BottomEnd target `Bench`/`Delete`, Bench cluster + `On the bench` sheet, drag back to restore, Undo snackbar, Reset / Reshuffle, TalkBack actions, haptics; saves via `PUT /arrangement` with 409 handling.

**Blocked by:** 07

**Status:** ready-for-agent

**Glossary:** Manual order, Bench, Rule copy. **ADRs:** 0028–0030. **Design:** interaction-spec §4, §6, §12; android-notes "Drag" (Option B: `detectDragGesturesAfterLongPress` + layout hit-testing).

**Files:** `ui/graph/DragState.kt`, `ui/graph/BenchTarget.kt`, `ui/graph/BenchCluster.kt`, `ui/editor/BenchSheet.kt`, `domain/ArrangementOps.kt` (Kotlin twins of web `arrangement-ops.ts`: `benchOriginal`, `deleteCopy`, `deleteRepeatPlay`, `restoreFromBench`, `moveOriginal`), `data/ArrangementRepository.kt`.

**Acceptance criteria**
- [ ] `ArrangementOpsTest` uses the same cases as web `arrangement-ops.test.ts` (copy the table).
- [ ] Compose tests: target label per node kind, snackbar strings per §12, cluster hidden at 0, TalkBack custom actions "Move to bench" / "Delete this copy" / "Move to slot…".
- [ ] 409 → state reloaded, snackbar `Updated from another device.`
