# 09: Mixes and Source playlist picker (vertical)

**Status:** done
**Type:** task
**Blocked by:** 03, 04, 06, 07
**Glossary terms:** Mix, Source playlist, Target playlist, Seed
**Refs:** spec stories 19–23, 33; ADR-0004, 0014, 0015, 0017; mockup `index.html` (Home + Mix builder phones), `desktop.png`, `mobile.png`, `motion/builder-motion.mp4`
**Env vars:** `MAX_SOURCE_TRACKS` (default 600), plus the Spotify and database vars

## What to build
Home (`/mixes`) lists the user's Mixes. "New mix" opens the Mix builder at `/mixes/new`, where the user names the Mix and picks a Source from Liked Songs, their own playlists or collaborative ones. Sources over `MAX_SOURCE_TRACKS` can be seen but not selected, with a clear message. Saving creates the Mix with a random Seed. Mixes can be renamed and deleted. Rules and the Preview come in tickets 10 and 11.

## Files
- `apps/web/lib/spotify-for-user.ts`: `export function spotifyForUser(sql, userId): SpotifyClient` = `createClient(spotifyConfig(), dbTokenStore(sql, userId))`.
- `apps/web/lib/db/mixes-repo.ts`:
  ```ts
  export interface MixSource { type: "playlist" | "liked"; id: string | null; name: string }
  export interface MixRow { id: string; name: string; source: MixSource; keepSourceOrder: boolean; shuffleSeed: number; targetPlaylistId: string | null; lastSavedAt: string | null; ruleCount: number; createdAt: string; updatedAt: string }
  export function listMixes(sql, userId): Promise<MixRow[]>; // updated_at desc
  export function getMix(sql, userId, id): Promise<MixRow | null>;
  export function createMix(sql, userId, input: { name: string; source: { type: "playlist"|"liked"; id: string | null; name: string } }, seed: number): Promise<MixRow>;
  export function updateMix(sql, userId, id, patch: { name?: string; source?: {type:"playlist"|"liked"; id: string|null; name: string}; keepSourceOrder?: boolean; shuffleSeed?: number; targetPlaylistId?: string | null; lastSavedAt?: string; lastSnapshotId?: string }): Promise<MixRow | null>;
  export function deleteMix(sql, userId, id): Promise<boolean>;
  export function randomSeed(): number; // crypto.getRandomValues(new Uint32Array(1))[0]
  ```
  - Add the migration `supabase/migrations/0002_mix_source_name.sql`: `alter table mixes add column source_name text not null default '';`. It stores the display name for Home's meta line.
  - Changing the source deletes the Mix's `mix_rules` in the same transaction, because rule songs belong to the old source.
- Routes:
  - `app/api/sources/route.ts` (GET): returns `{ sources: (SourceOption & { tooLarge: boolean })[], maxSourceTracks: number }`. It calls `listSources(client, user.id)` and sets `tooLarge = trackCount > MAX_SOURCE_TRACKS`.
  - `app/api/mixes/route.ts`:
    - GET returns `{ mixes }`.
    - POST takes `{ name, source:{type,id} }`. It re-checks the size server-side with `getSourceTrackCount`; over the limit it returns 422 `source_too_large`, with the message `This source has {count} songs. rulemix handles up to {max}.` It also checks that the source is in `listSources` (owned, collaborative or liked); otherwise it returns 422 `source_not_allowed`. On success it returns 201 `{ mix }`.
  - `app/api/mixes/[id]/route.ts`:
    - GET returns `{ mix }` or 404.
    - PATCH takes `{ name?, source?, keepSourceOrder? }`, and a changed source gets the same checks as POST.
    - DELETE returns 204. The Target playlist in Spotify is not touched.
- Pages and components:
  - `app/mixes/page.tsx` (replaces the placeholder): a header with the Logo, "Mixes" and the Rules icon at the top right, plus a "New mix" button.
    - Each row shows the cover tile, the name, and the meta line `{sourceName} · {ruleCount} rules · {relative lastSavedAt}`, or `· not generated` when the Mix was never saved.
    - Empty state: "No mixes yet" with "Pick a playlist, add a rule or two, and generate a copy to play in Spotify."
    - Rows stagger 50ms.
  - `app/mixes/new/page.tsx` and `app/mixes/[id]/page.tsx` → `components/mix/mix-builder.tsx` (client). In this ticket it contains:
    - a name input with the placeholder "Name this mix";
    - a SOURCE section with the hints "Your playlists, collabs or Liked Songs." and "Discover Weekly and other Spotify-made lists need a copy in your library first.";
    - a source card that opens `components/mix/source-picker-sheet.tsx` (shadcn Sheet listing sources, with `tooLarge` rows disabled and the subtitle `{count} songs · over the {max} limit`);
    - the RULES section, left as a placeholder for ticket 10;
    - a "Delete mix" item in a ⋯ menu.
  - New mixes are created on the first valid name and source (POST), followed by `router.replace('/mixes/<id>')`. Name edits PATCH on blur.

## Tests (write first)
- `mixes-repo.test.ts`:
  - create (the seed is stored) and list;
  - users are isolated from each other;
  - changing the source deletes mix_rules;
  - `ruleCount`;
  - delete cascades.
- `sources-route.test.ts` (fake-spotify): filters followed playlists, marks `tooLarge` with `MAX_SOURCE_TRACKS=5`, and puts Liked first.
- `mixes-routes.test.ts`:
  - POST with an oversized source → 422 `source_too_large` with the exact message;
  - a followed playlist id → 422 `source_not_allowed`;
  - a valid POST → 201 with a seed in the uint32 range;
  - PATCH rename;
  - DELETE.
- `mix-builder.test.tsx`: a disabled too-large source can't be picked, and the hint copy is present.
- `e2e/mixes.spec.ts` (seeded session plus the app pointed at fake-spotify through env): create a mix from Liked Songs, see it on Home with "· not generated", then delete it.

## Acceptance criteria
- [x] Followed playlists never appear (ADR-0014); the source limit is enforced on both the client and the server
- [x] All copy is exact; all tests pass

## Notes (implementation)
- Delete mix asks "Delete this mix?" / "Its Spotify playlist stays." (Not now / Delete) before deleting; copy not in the ticket.
- Picker sheet title "Pick a source" and load error "Couldn't load your playlists. Try again." are new copy.
- Home meta uses "1 rule" for a single rule; relative time is "just now / Nm ago / Nh ago / Nd ago".
- Home keeps a small "Sign out" link (from the placeholder) under the list.
- e2e: playwright starts a fake Spotify (`e2e/fake-spotify-server.ts`, port `E2E_FAKE_SPOTIFY_PORT`, default E2E_PORT+1000) and points the dev server at it.
- Source change from the builder does not confirm yet (no rules UI until ticket 10); the server deletes mix_rules on a real source change.
