# 07: Bench and delete: corner target, cluster, panel, bring back

**What to build:** dragging shows the bottom-right target (`Bench` for Originals, `Delete` for Rule copies / Repeat stacks); dropping benches or deletes with Undo; the Bench cluster and `On the bench` panel; dragging a benched song onto the line restores it there; popover actions `Move to bench` / `Delete this copy`.

**Blocked by:** 06

**Status:** ready-for-agent

**Glossary:** Bench, Rule copy, Original song, Manual order. **ADRs:** 0030. **Design:** interaction-spec §12 (all strings), shots `desktop-bench.png`, `mobile-bench.png`, motion `bench.mp4`.

**Files:** `apps/web/components/graph/bench-target.tsx`, `bench-cluster.tsx`, `bench-panel.tsx`; `apps/web/lib/arrangement-ops.ts` (pure): `benchOriginal(a, uri, line)`, `deleteCopy(a, ruleId, k)`, `deleteRepeatPlay(a, ruleId)`, `restoreFromBench(a, uri, index, line)` (sets Manual order with the song inserted at `index`), each returning a new `ArrangementInput`.

**Acceptance criteria**
- [ ] `arrangement-ops.test.ts` covers each op incl. restore at start/middle/end and Repeat reaching 1.
- [ ] Component tests: correct target label per dragged node; toasts per §12; cluster label `Bench, {n} songs. Tap to open.` / `1 song`, hidden at 0; panel empty state; Enter on a bench row restores at the end.
- [ ] Playwright: bench a song, reload, it is still benched and absent from Play's written uris (fake Spotify); bring it back to slot 3.
