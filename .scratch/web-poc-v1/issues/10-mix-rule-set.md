# 10: Rule Set in a Mix: add (rule → song), reorder, remove, limit

**Status:** done
**Type:** task
**Blocked by:** 08, 09
**Glossary terms:** Rule Set, Rule, Mix, Source playlist
**Refs:** spec stories 24–29; ADR-0017 (MAX_RULES_PER_MIX, colour by position); design "Decisions" (rule picker → song picker); mockup `index.html` (builder, rule picker sheet, song picker sheet), `motion/builder-motion.mp4`
**Env vars:** `MAX_RULES_PER_MIX` (default 10)

## What to build
In the Mix builder, "+ Add rule" opens a rule picker (non-archived rules from the library, plus "New rule" linking to `/rules/new?mix=<id>`). After a rule is picked, a song picker lists the Source's songs. Choosing one adds a card. Cards can be dragged to reorder (numbers and colours update live) and removed. "+ Add rule" is hidden at `MAX_RULES_PER_MIX`, and the line "Up to {max} rules per mix." appears in its place.

## Files
- `apps/web/lib/db/mix-rules-repo.ts`:
  ```ts
  export interface MixRuleRow { id: string; ruleId: string; kind: RuleKind; n: number | null; position: number; trackUri: string }
  export function listMixRules(sql, userId, mixId): Promise<MixRuleRow[]>; // position asc; joins rules
  export function addMixRule(sql, userId, mixId, input: { ruleId: string; trackUri: string }, maxRules: number): Promise<{ ok: true; row: MixRuleRow } | { ok: false; code: "limit" | "not_found" | "archived" }>; // appended at end
  export function reorderMixRules(sql, userId, mixId, orderedIds: string[]): Promise<boolean>; // must be a permutation of current ids; single transaction (deferred unique)
  export function removeMixRule(sql, userId, mixId, mixRuleId): Promise<boolean>; // compacts positions 0..k-1
  ```
- `apps/web/lib/source-tracks.ts`:
  - `export async function readSourceTracks(client: SpotifyClient, source: { type: "playlist"|"liked"; id: string|null }, onProgress?: ReadProgress): Promise<(TrackItem|null)[]>`. It throws `HttpError(422,"source_too_large")` if the count exceeds `MAX_SOURCE_TRACKS`, checked with `getSourceTrackCount` before reading.
  - Each read also upserts the names into `track_cache` (`uri`, `name`, `artists`, `fetched_at=now()`).
- Routes:
  - `app/api/mixes/[id]/rules/route.ts`:
    - GET returns `{ rules: MixRuleRow[], maxRules }`.
    - POST takes `{ ruleId, trackUri }`. It returns 201, or 409 `rule_limit` with the message "Up to {max} rules per mix.", or 422 `rule_archived`, or 404. It also checks that `trackUri` is in the source tracks; otherwise 422 `song_not_in_source`.
  - `app/api/mixes/[id]/rules/order/route.ts`: PUT `{ ids: string[] }` → 204, or 400 `bad_order`.
  - `app/api/mixes/[id]/rules/[mixRuleId]/route.ts`: DELETE → 204.
  - `app/api/mixes/[id]/songs/route.ts`: GET returns `{ songs: TrackItem[] }`, the available source tracks de-duplicated by uri in source order, for the song picker.
- Components (in `mix-builder.tsx`, RULES section):
  - Header RULES with the hint "Drag to reorder. The top rule wins a conflict."
  - Empty state: "No rules yet. Without one, you just get a copy."
  - `components/mix/rule-card.tsx`:
    - a mono `#01`…`#10` gutter;
    - a colour dot from `ruleColor(index)`;
    - the `mixRuleCardLine(kind,n,songName)`;
    - a drag handle;
    - a remove (×) button with `aria-label="Remove rule"`.
  - Drag uses Framer Motion `Reorder.Group`/`Reorder.Item`, with keyboard support (↑/↓ while the handle is focused). On drop it PUTs the order, optimistically, and rolls back on error.
  - `components/mix/rule-picker-sheet.tsx`: lists non-archived rules with a neutral dot, the sentence and the caption, plus a "New rule" row linking to `/rules/new?mix=<mixId>`. Rows stagger 30ms.
  - `components/mix/song-picker-sheet.tsx`: heading "Pick the rule's song". It lists the songs (name · artists) with a client-side search input filtering by name or artist.
  - Handling `?addRule=<ruleId>` (from the editor's "Save & add to mix") opens the song picker directly for that rule, then strips the query param.

## Tests (write first)
- `mix-rules-repo.test.ts`:
  - add appends positions 0, 1, 2;
  - the limit is enforced (with maxRules=2 the third add → `limit`);
  - adding an archived rule → `archived`;
  - reorder with a permutation works, and a non-permutation → false;
  - remove compacts positions;
  - users are isolated.
- `mix-rules-routes.test.ts` (fake-spotify source): `song_not_in_source`, 409 `rule_limit` with `MAX_RULES_PER_MIX=1`, `bad_order`.
- `source-tracks.test.ts`: too-large → 422 before reading items; `track_cache` is upserted.
- `rule-card.test.tsx`: card 0 uses colour `#e8b04b` and the label `#01`; card 9 uses `#c8b08a` and `#10`.
- `mix-builder-rules.test.tsx`:
  - add flow (rule → song → card appears);
  - "+ Add rule" is hidden at the limit and the limit text is shown;
  - keyboard reorder calls PUT with the new order.

## Acceptance criteria
- [x] Each rule in a Mix gets its song from the Mix's Source; the same Rule can carry different songs in different Mixes
- [x] Colour follows position (index 0 → R1)
- [x] All tests pass

## Notes (implementation)
- `readSourceTracks(sql, client, source, onProgress?)` takes `sql` first, because it upserts `track_cache`.
- `MixRuleRow` also carries `songName` (left join on `track_cache`; null until the Source was read). Cards show "Unknown song" if null.
- POST `/api/mixes/[id]/rules` returns 201 `{ rule }`. Other new copy: "That song isn't in this mix's source.", "That rule is archived. Restore it first.", "The rules changed. Reload and try again.", "Couldn't load your rules. Try again.", "Couldn't load the songs. Try again.", search placeholder "Search songs", rule-picker title "Add a rule" (from mockup).
- Adding/reordering/removing rules bumps `mixes.updated_at`.
- Keyboard reorder: ↑/↓ on the focused handle (aria-label "Reorder #NN").
- Mix builder now confirms a source change when the Mix has rules: "Change source?" / "This clears the rules in this mix." (Not now / Change). Closes t09 deviation 5.
- Fake library (`lib/testing/fake-library.ts`) now serves Liked and "Gym bangers" items for tests and e2e.
