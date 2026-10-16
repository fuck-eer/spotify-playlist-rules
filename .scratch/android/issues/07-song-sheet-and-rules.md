# 07: Song bottom sheet and adding rules

**What to build:** tap a cover → `ModalBottomSheet` with art, song, rules on it (Change/Remove), Start with / After every N / Repeat with stepper, Open in Spotify; rule list edits as web.

**Blocked by:** 06

**Status:** ready-for-agent

**Design:** interaction-spec §3; shot `mobile-popover.png`.

**Files:** `ui/editor/SongSheet.kt`, `ui/editor/RulesSection.kt`, `data/RulesRepository.kt` (existing rules endpoints).

**Acceptance criteria**
- [ ] Compose tests for each add path, 10-rule cap message, stepper bounds/defaults.
- [ ] MockWebServer tests for the rule calls.
