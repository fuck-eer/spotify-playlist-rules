# 06: Long-press drag to reorder Original songs (Manual order) + Undo, Reset, Reshuffle

**What to build:** long-press an Original cover, drag to another Original's position, drop to save the Manual order with Undo; Rule copies spring back; Reset to rule order and Reshuffle (confirm when an order exists); keyboard and Go to slot.

**Blocked by:** 04

**Status:** ready-for-agent

**Glossary:** Manual order, Original song, Rule copy, Seed. **ADRs:** 0028, 0029. **Design:** interaction-spec §4, §5.

**Files:** `apps/web/components/graph/use-drag.ts` (`lift`/`dragMove`/`dropAt`/`cancelDrag`, 350 ms, 8 px slop, nearest Original within 70 px, edge auto-scroll 48 px); `apps/web/lib/arrangement-client.ts` (`saveArrangement(mixId, next, prev)`: optimistic local build, PUT, on 409 replace with server state and toast `Updated from another device.`, Undo PUTs prev); Reset/Reshuffle buttons in mix-builder.

**Acceptance criteria**
- [ ] Unit tests for `moveOriginal(order, from, to)` and the drop-target picker.
- [ ] Component tests: drop saves and toasts `Moved to slot {k}. Order saved.`; Undo restores; rule cover refusal toast; 409 path.
- [ ] Keyboard: Space pick-up, arrows skip rule covers, Space drop, Esc cancel; Go to slot validation `Pick a slot from 1 to {total}.`
- [ ] Playwright drag reorder persists after reload.
