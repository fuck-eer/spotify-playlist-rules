# Spec: rulemix v2 (interactive cover graph on web + native Android app)

Status: ready-for-agent, except everything that depends on ADR-0034 (Android auth), which is **Proposed, needs Nishchay's approval**.
Sources: ADR-0026 to ADR-0034, GLOSSARY.md, docs/research/android-queue-vs-playlist.md, design DSN-20261016-playlist-rules-v2 (`interaction-spec.md`, `motion-spec.md`, `android-notes.md`, `inventory.md`, `tokens.json`, `index.html` prototype). Tickets: `.scratch/v2-web/`, `.scratch/android/`.

## Problem Statement

The v1 Preview is a passive dot line: I can only shape a Mix by adding rules in a list and reshuffling. I want to see my playlist as album covers on a line, tap a song to add a rule to it, drag songs into the order I want, and take songs out without deleting them. And I want the same thing on my Android phone, synced with the web, playing through Spotify the same way.

## Solution

- **Web v2:** the Mix editor's Preview becomes the **cover graph**: one circle cover per play group on a wrapping (boustrophedon) line. Original songs have a grey ring; Rule copies have their rule's colour and `#n` chip; a Repeat is a stacked cover marked `xN`. Tap a cover for a popover with the song and rule buttons. Long-press and drag an Original song to reorder (saved as the Manual order). Drag any cover to the corner target: an Original song goes to the **Bench**, a Rule copy or one play of a Repeat is deleted. Everything animates with the v2 motion tokens.
- **Android:** a native Kotlin + Jetpack Compose app with the same screens and flow (sign in, Mix list, Mix editor with the cover graph, Play), the same backend and data, a Kotlin port of the rules engine checked against the same JSON fixtures, and Play via the Player playlist (ADR-0026).

## User Stories

### Cover graph (web and Android)
1. As a user, I want my Mix shown as circle album covers on one continuous wrapping line, so that I can see the play order at a glance.
2. As a user, I want Original songs drawn with a grey ring and Rule copies with their rule's colour plus a `#n` chip, so that I can tell them apart without relying on colour.
3. As a user, I want a Repeat shown as one stacked cover marked `xN` with a slot range (e.g. `5-7`), so that the line stays short.
4. As a user, I want a slot number under every cover, so that I know where each song plays.
5. As a user, I want a shifted Rule copy to show a split ring and `moved from #p`, so that I understand collisions.
6. As a user, I want covers to show album art with a gradient placeholder when art is missing or loading, so that the graph never looks broken.
7. As a user with a 600-song Mix, I want the graph to scroll smoothly, so that big playlists are usable.
8. As a user, I want the summary to show the true total (`{t} songs · {r} rules`, plus `· your order` when a Manual order is set).

### Tap and rules
9. As a user, I want to tap any cover to open a popover (web) or bottom sheet (Android) with art, name, artist, `moved from #p` if shifted, the rules on this song (Change/Remove), and Open in Spotify.
10. As a user, I want three icon buttons in that card (Start with, After every N, Repeat), so that I can add a rule to this song in one or two taps.
11. As a user, I want After every N and Repeat to show an inline stepper (2 to 10, defaults 4 and 2) with Add.
12. As a user at 10 rules, I want the rule buttons disabled with `Up to 10 rules per mix.`
13. As a user, I want the `N songs skipped (unavailable)` link to open the unavailable songs in the same card, so that every source song is openable.

### Manual order
14. As a user, I want to long-press (350 ms) an Original song and drag it to another Original song's position, so that I can set my own order.
15. As a user, I want the drop to save my order on the server and show `Moved to slot {k}. Order saved.` with Undo for 4 s.
16. As a user, I want Rule copies to stay at their slots while Original songs flow around them.
17. As a user dragging a Rule copy anywhere but the delete target, I want it to spring back with `Rule songs stay where their rule puts them.`
18. As a user, I want Reshuffle to clear my Manual order (after a confirm when one is set) and pick a new Seed, and Reset to rule order to clear it without a new Seed.
19. As a keyboard or TalkBack user, I want to move an Original song with keys or a "Move to slot…" action, and jump with Go to slot.

### Bench and deleting copies
20. As a user dragging any cover, I want a target to spring in at the bottom-right of the graph: `Bench` for an Original song, `Delete` for a Rule copy or a Repeat stack.
21. As a user, I want dropping an Original song on Bench to take it out of the Mix without losing it (`Benched. It won't play in this mix.` + Undo); its Rule copies stay on the line.
22. As a user, I want dropping a Rule copy on Delete to remove just that copy (`Copy deleted. Rule #{n} still applies.` + Undo), and dropping a Repeat stack to remove one play (`One play deleted. Rule #{n} still applies.`); at one play the Repeat rule disappears.
23. As a user, I want the Bench shown as a pill at the bottom-right of the graph with the last 3 benched covers and `Bench · {n}`, hidden when empty.
24. As a user, I want tapping the Bench to open `On the bench` (popover on web, bottom sheet on Android) listing benched songs, so that I can see what I took out.
25. As a user, I want to drag a benched song onto the line to bring it back at that point (`Back in at slot {k}`), after which it reorders like any Original song.
26. As a user, I want the Bench and deleted copies to survive Reshuffle and Reset to rule order.
27. As a user, I want benched songs and deleted copies never written to Spotify by Play or Save.

### Source sync
28. As a user who added songs to the Spotify Source playlist, I want them appended at the end of the line, keeping my order and Bench.
29. As a user who deleted songs from the Source playlist, I want them dropped from the Mix entirely (not benched), while their Rule copies keep playing.

### Sync across devices
30. As a user, I want my Manual order, Bench and deleted copies saved per Mix on the server, so that web and Android show the same Mix.
31. As a user editing on two devices, I want a stale edit rejected and my screen refreshed with the latest state (`Updated from another device.`), so that nothing is silently overwritten.

### Motion
32. As a user, I want the line to draw in and covers to pop in when the editor opens, lifts and drops to spring, the graph to reflow smoothly, and sheets to slide, per the v2 motion spec.
33. As a user with reduced motion on, I want all of that skipped, with states changing instantly.

### Android app
34. As an Android user, I want to sign in with my own Spotify account in one step through the Spotify app.
35. As an Android user, I want the same Mix list, Mix editor and Play as on web.
36. As an Android user, I want Play to write the Player playlist and start it from the first track with shuffle off, or open it in Spotify if that fails.
37. As an Android user without Spotify installed, I want a short message and a Play Store install button.
38. As an Android user offline, I want to see my last synced Mixes read-only, with editing and Play disabled and a clear offline note.
39. As an Android user, I want haptics on lift, crossing a drop target, drop and refusal.
40. As a visitor on rulemix.vercel.app, I want a "Get the Android app" button that downloads the signed APK.

## Implementation Decisions

### Engine v2 (packages/rules-engine, Kotlin port)
- `build` becomes the v2 algorithm (ADR-0027..0030); the v1 shape is replaced, not kept beside it (only the web app consumes it). Input gains the arrangement:
  - `rules[i]` gains `id` (the Mix rule id), `removedPlays` (Repeat only, default 0) and `deletedCopies` (copy indexes, default []).
  - `manualOrder: string[] | null` (Original URIs) and `bench: string[]` (Original URIs).
- Algorithm (adapted from the prototype's mock engine; decision-rich parts):
  1. `available` = Source items that are non-null `spotify:track:` URIs, **de-duplicated by first occurrence** (v2 change: an Original song appears once).
  2. `line` = if `manualOrder`: its URIs that are in `available`, then the `available` URIs not in it, in Source order (Source sync: new songs appended). Else `keepSourceOrder ? available : seededShuffle(available, seed)`. Then remove `bench` URIs.
  3. `B = line.length`. Slot counts: Start with 1; After every N `max(1, floor(B/n))` (ADR-0019); Repeat 0 (it lives on its Original). `L = B + sum`.
  4. Claim rule slots in rule priority order: Start with at 0; After every N copy `k` (1-based) at `min(k*(n+1)-1, L-1)`. Taken slot → ADR-0020 merge for a same-song every-N, else next free slot forward then backward, with `shiftedFrom`. A rule whose song is not in `available` still places its copies and reports `rule_song_not_in_source` (ADR-0030: copies survive; also covers Unavailable rule songs). A Repeat whose song is not on `line` places nothing and reports the same issue.
  5. Fill free slots with `line` in order. Each Original gets `plays = n - removedPlays` of the highest-priority Repeat on its URI (min 1; no Repeat → 1). Trailing free slots left by merges are dropped.
  6. Remove deleted copies (`deletedCopies` match); later nodes move up (the grid is not re-filled).
  7. `uris` expands each node to `plays` entries. `stats.total` = `uris.length`.
- Node shape (replaces `PreviewSlot`):
  ```ts
  // from the prototype's node model
  interface GraphNode {
    key: string;              // "b:<uri>" Original, "r:<mixRuleId>:<k>" Rule copy (k=0 Start with, 1.. every-N)
    role: "original" | "copy";
    uri: string;
    plays: number;            // >= 2 only for a Repeat stack
    ruleIndex: number | null; // colour: copy's rule, or the Repeat rule on a stack; null for plain Originals
    ruleIndices: number[];    // merged slots (ADR-0020)
    shiftedFrom: number | null;
    copyIndex: number | null;
    firstSlot: number;        // 0-based play position of the node's first play
  }
  ```
  Issues: `{ kind: "rule_song_not_in_source"; ruleIndex }`. Stats: `total`, `rulesApplied`, `skippedUnavailable`, `benched`.
- Every-N counts nodes of the final line (a Repeat stack is one node), as in the prototype.
- **Fixtures** stay the contract (ADR-0031): all `packages/rules-engine/fixtures/*.json` are rewritten for v2 by hand, plus new cases (manual order, bench, Source append/drop, deleted copy, Repeat decrement, merged slot, rule song not in source), plus `fixtures/prng.json` (mulberry32 and `seededShuffle` vectors). The Kotlin engine reads the same directory.

### Data model (migration 0006)
- `mixes`: `manual_order text[] null`, `bench text[] not null default '{}'`, `arrangement_version int not null default 0`.
- `mix_rules`: `removed_plays int not null default 0 check (removed_plays >= 0)`, `deleted_copies int[] not null default '{}'`.
- `track_cache`: `image_url text null`. `sessions`: `kind text not null default 'web' check (kind in ('web','mobile'))`.
- A Repeat Mix rule whose `n - removed_plays` reaches 1 is deleted.

### API
- `GET /api/mixes/{id}/state` → `{ mix, rules, source: SourceItem[], tracks: Record<uri, {name, artists, imageUrl}>, arrangement: { manualOrder, bench, version } }`. Reading it prunes `manual_order` and `bench` of URIs no longer in the Source (Source sync, ADR-0028/0030) and bumps the version if anything changed. Clients run `build` locally (instant drag feedback).
- `PUT /api/mixes/{id}/arrangement` body `{ version, manualOrder, bench, rules: [{ id, removedPlays, deletedCopies }] }` → 200 `{ version }`; 409 `{ state }` when `version` is stale; 404 for another user's Mix; 422 invalid. Undo = PUT of the previous snapshot.
- `POST /api/mixes/{id}/reshuffle` clears `manual_order` and sets a new seed (Bench and deletions kept). New `POST /api/mixes/{id}/reset-order` clears `manual_order` only.
- Play and Save build with the arrangement (benched and deleted never written).
- Mobile auth endpoints and Bearer support: ADR-0034 (proposed).

### Web UI
- New `components/graph/*` replaces the dot line in the Mix editor: pure `layout(n, width)` (boustrophedon, 72 px columns, 92 px rows, min 3 columns), row virtualisation (viewport ± 2 rows), wire per row segment, covers with lazy images.
- Interactions and strings exactly as `interaction-spec.md` §3–§12. Motion via `motion` (Framer Motion) with the tokens in `motion-spec.md` in one `lib/motion.ts`.
- Keyboard: covers are buttons in a list; arrow keys, Space pick-up/drop, Go to slot.
- "Get the Android app" button on the signed-out home page and in the account menu, linking to `/android/rulemix.apk`.

### Android
- Module `apps/android` (Gradle, Kotlin, Compose, M3), package `com.rulemix.app`, minSdk 26, targetSdk 33 (App Remote workaround), App Remote 0.8.0 + auth 2.1.0 AARs.
- Kotlin engine in `apps/android/engine` (pure JVM module) passing the shared fixtures.
- Networking: Ktor client or OkHttp + kotlinx.serialization against the same API with `Authorization: Bearer`.
- Offline cache: last `GET /api/mixes` and each Mix's last `state` stored as JSON files in app storage; read-only when offline (connectivity via `ConnectivityManager`).
- Play: `POST /api/mixes/{id}/play`, poll the run, then App Remote `setShuffle(false)` + `play(spotify:playlist:<playlistId>)`; fallback `Intent(ACTION_VIEW, spotify:playlist:…)` then https link.
- Spotify not installed: `SpotifyAppRemote.isSpotifyInstalled` false → message + Play Store button.
- Theme from `tokens.json`; motion object `Motion` with the four tokens (ADR-0031); haptics per interaction-spec §6.
- Distribution: release build signed with a keystore kept outside the repo; APK copied to `apps/web/public/android/rulemix.apk`.

## Testing Decisions
- Test external behaviour only: engine output for inputs, HTTP responses for requests, what the user sees and can do.
- Engine: the shared fixtures (TS vitest and Kotlin JUnit run the same files), the existing property tests updated (length = sum of plays, benched never present, deleted copies absent, same input → same output).
- Server: route tests with the existing route harness + test database + fake Spotify (prior art: `lib/play-route.test.ts`, `lib/save.test.ts`).
- Web UI: component tests with mocked fetch (prior art: `components/mix/mix-builder-*.test.tsx`), Playwright for drag, bench and restore against the e2e fake Spotify (prior art: `e2e/play.spec.ts`).
- Android: JUnit for the engine and repositories (MockWebServer), Compose UI tests for the graph, drag and bench, Robolectric-free where possible.

## Out of Scope
- Play Store distribution; the Android-only landing page (later phase).
- iOS. Background playback monitoring or skipping hand-queued songs.
- Changing Rule priority from the graph (still in the RULES list).
- Real-time push sync (clients refetch on focus and on 409).

## Further Notes
- Decisions I made that Nishchay may want to override are listed at the end of `.scratch/v2-web/map.md`.
- Nothing Android-auth-dependent starts before ADR-0034 is approved.
