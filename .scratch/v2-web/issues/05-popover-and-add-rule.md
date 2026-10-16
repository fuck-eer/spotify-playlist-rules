# 05: Tap a cover: song popover / sheet with rule buttons

**What to build:** tapping any cover (or the skipped link) opens the song card; Start with adds at once; After every N and Repeat open the stepper; rules on the song can be changed or removed; Open in Spotify.

**Blocked by:** 04

**Status:** ready-for-agent

**Glossary:** Rule, Rule Set, Pin first, Insert every N, Repeat N times. **Design:** interaction-spec §3; shot `mobile-popover.png`.

**Files:** `apps/web/components/graph/song-popover.tsx` (popover ≥ 768 px, bottom sheet below); uses existing rules API (`POST /api/mixes/{id}/rules` with the library rule for that kind/n, created if missing via existing `lib/rules-api.ts`).

**Acceptance criteria**
- [ ] Tap = pointer down/up < 350 ms and < 8 px; Esc/outside/scrim closes and returns focus.
- [ ] Adding Start with on a song shows a new copy at slot 1; stepper bounds 2–10, defaults 4/2; 10-rule cap disables buttons with `Up to 10 rules per mix.`
- [ ] Component tests with mocked fetch for each path; Playwright: add After every 4 from the popover and see copies.
