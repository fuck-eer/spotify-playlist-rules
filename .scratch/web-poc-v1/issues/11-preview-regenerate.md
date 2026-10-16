# 11: Preview + Regenerate, base order option, Reshuffle

**Status:** done
**Type:** task
**Blocked by:** 02, 10
**Glossary terms:** Preview, Regenerate, Base list, Seed, Unavailable track, Rule Set
**Refs:** ADR-0003, 0004, 0005, 0006, 0011, 0012, 0013; spec stories 30–32, 34–41; mockup `index.html` (builder OPTIONS + PREVIEW), `motion/builder-motion.mp4`

## What to build
The Mix builder shows OPTIONS and a live PREVIEW computed by the rules engine from the real Source. "Regenerate" recomputes the Preview from fresh Spotify data and never writes to Spotify. Moving a rule, toggling "Keep base order" or pressing Reshuffle refreshes the Preview. Shifted songs show the "moved from #p" badge. Unavailable songs are counted, and rules whose song is unavailable show a warning.

## Files
- `apps/web/lib/preview.ts`:
  ```ts
  export interface PreviewResponse { slots: PreviewSlot[]; names: Record<string, string>; kinds: RuleKind[]; stats: BuildStats; issues: BuildIssue[]; summary: string; skippedText: string | null }
  export async function computePreview(sql, userId: string, mixId: string, client: SpotifyClient): Promise<PreviewResponse>;
  ```
  It loads the Mix and its mix rules, reads the source tracks (`readSourceTracks`, ticket 10), and calls `build({ source, rules, keepSourceOrder, seed })`. Then:
  - `names` maps uri → song name (from the source items);
  - `summary` = `${stats.total} tracks · ${stats.rulesApplied} rules applied`, or `1 rule applied` in the singular;
  - `skippedText` = `${n} songs skipped (unavailable)` (`1 song skipped (unavailable)` when n=1), or null when n=0.
- Routes:
  - `app/api/mixes/[id]/preview/route.ts` (GET) returns `PreviewResponse`. It is computed fresh on each call (no server cache), which makes it the Regenerate endpoint (ADR-0013).
  - `app/api/mixes/[id]/reshuffle/route.ts` (POST) sets `shuffle_seed = randomSeed()` and returns `{ seed }`.
  - PATCH `/api/mixes/[id]` from ticket 09 already accepts `keepSourceOrder`.
- Components (`mix-builder.tsx`):
  - **OPTIONS** contains one Switch, "Keep base order", with the subtitle "Off reshuffles the base list once before rules run." It defaults to off (ADR-0004). When it's off, a "Reshuffle" text button appears.
    - The mockup's "Remove rule songs from base" toggle is not built, because that behaviour is always on (ADR-0005, A7).
  - **PREVIEW:**
    - `DotLine` with `previewToDots(slots, names, kinds)`, `maxDots` 22 and `totalCount` = `stats.total`;
    - the `summary` in mono;
    - `skippedText` in mono dim when present;
    - a "Regenerate" secondary button that refetches the preview and shows a Skeleton while loading.
  - Rule cards whose index appears in `issues` (`unavailable_rule_song`) show a warning icon plus the text "Song unavailable. Pick another." in `#f15e6c`.
  - The Preview refetches after each rule add, remove or reorder, each option toggle, and each reshuffle, debounced by 300ms.
  - Conflicts use shift + badge, not the mockup's skip behaviour (ADR-0012).

## Tests (write first)
- `preview.test.ts` (test database + fake-spotify):
  - the summary and singular/plural copy;
  - `skippedText` with 2 null items is "2 songs skipped (unavailable)";
  - a rule song that disappears from the source gives `unavailable_rule_song`;
  - `keepSourceOrder=true` gives source order;
  - with the same seed, two calls give identical slots;
  - a pin + repeat on the same song shifts, and the slot has `shiftedFrom: 0`.
- `preview-route.test.ts`: GET makes no POST or PUT calls to fake-spotify (a read-only assertion, ADR-0013); reshuffle changes the seed.
- `mix-builder-preview.test.tsx`:
  - the badge "moved from #1" renders;
  - toggling Keep base order hides Reshuffle;
  - the warning text shows on the flagged card.

## Acceptance criteria
- [x] Regenerate never writes to Spotify
- [x] The Preview matches `build()` exactly (no separate UI logic)
- [x] All tests pass

## Notes (implementation)
- Builder section order follows the mockup: SOURCE, PREVIEW, RULES, OPTIONS. PREVIEW/OPTIONS show once the Mix exists.
- Preview rendering lives in `components/mix/preview-panel.tsx` (pure render of `build()` output via `previewToDots`); state/debounce in `mix-builder.tsx`. First load immediate; later refreshes debounced 300ms; stale responses ignored. Regenerate fetches immediately.
- New copy: preview error fallback "Couldn't build the preview. Try again.".
- Preview route sends `cache-control: no-store`. 404 for unknown/foreign mixes.
- Extra e2e `e2e/preview.spec.ts` (summary, Regenerate, Keep base order persists, Reshuffle hidden).
