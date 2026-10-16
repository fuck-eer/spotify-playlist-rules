# Spec: rulemix web PoC v1

Status: ready-for-agent
Scope: apps/web (Next.js), packages/rules-engine, packages/spotify, Supabase schema. Android is out of scope.
Sources: docs/plan/plan.md, docs/research/architecture.md, docs/design/design.md + mockup DSN-20261016-playlist-rules, docs/adr/0001–0018, GLOSSARY.md.

## Problem Statement

Spotify only gives me play, pause, skip and shuffle. I can't say "this song always opens the playlist", "drop this song in every 5 tracks" or "play this one twice in a row". AI shuffle decides for me. I want my own simple, reusable rules applied to my playlists, and then I want to play the result in the normal Spotify app.

## Solution

**rulemix** is a web app, reached by URL and hosted on Vercel. I sign in with Spotify and build a **Mix**:
- Pick a **Source playlist**: one I own, a collaborative one, or Liked Songs.
- Add **Rules** from my library (Pin first, Insert every N, Repeat N times) and pick a song from the source for each.
- Drag the rules to set priority.
- See a live **Preview** drawn as a dot line, where each song is a dot coloured by the rule that placed it.

**Regenerate** only refreshes the Preview. **Save to Spotify** writes the result to one private **Target playlist**, `Rules: <mix name>`, which I play with shuffle off. Rules are song-less templates, so one rule can be reused across Mixes.

## User Stories

### Sign-in and account
1. As a user, I want to sign in with Spotify, so that the app can read my playlists and write mixes.
2. As a user, I want to stay signed in across visits through a secure session, so that I don't re-authorize every time.
3. As a user, I want my Spotify tokens never exposed to browser JavaScript, so that my account is safe (ADR-0009).
4. As a user, I want to sign out, so that my session ends on this device.
5. As a user, I want a clear message when Spotify access has expired or been revoked, so that I know to sign in again.
6. As a dev-mode user, I want the sign-in screen to say access is limited to the owner and 4 friends, so that I understand why access may be refused.
7. As a user, I want all my data scoped to my Spotify user, so that friends using the app never see my Mixes or Rules.

### Rules library
8. As a user, I want a Rules library reached from a Rules icon at the top right of Home and the Mix builder, so that I can manage rules in one place.
9. As a user, I want to create a rule by picking a type (Pin first, Every N songs, Repeat) and its parameter N, with no song, so that I can reuse it across Mixes.
10. As a user, I want the rule editor to show a sentence builder with a live dot graphic of the rule's intent, so that I understand the rule before saving it.
11. As a user, I want N for Every N and Repeat to be adjustable (the mockup cycles 2–6), so that I can tune the rule.
12. As a user, I want to edit an existing rule, so that I can fix its parameters.
13. As a user, I want Active, Pinned and Archived tabs, so that I can keep my library tidy.
14. As a user, I want to pin a rule, so that favourites are easy to find.
15. As a user, I want to archive a rule, so that I can hide it without losing it.
16. As a user, I want to delete a rule that no Mix uses, after a "Delete this rule?" confirmation, so that I can remove mistakes.
17. As a user, when I try to delete a rule that a Mix uses, I want a "Used in N mixes" dialog offering Archive or Not now, so that I don't break a Mix (no force delete).
18. As a user, I want "Save & add to mix" when I open the editor from a Mix, so that a new rule goes straight into that Mix.

### Mixes
19. As a user, I want Home to list my Mixes with meta such as "Liked Songs · 3 rules · 2h ago" or "not generated", so that I can see their state at a glance.
20. As a user, I want to create a New mix and name it, so that I can organise different listening setups.
21. As a user, I want to pick a source from my owned playlists, collaborative playlists or Liked Songs only, with followed playlists hidden, so that I only see sources that work (ADR-0014).
22. As a user, I want a hint that Discover Weekly and other Spotify-made lists need a copy in my library first, so that I know the workaround.
23. As a user, I want a clear refusal when my source has more than MAX_SOURCE_TRACKS tracks (default 600), so that I know why it can't be used (ADR-0017).
24. As a user, I want to add a rule to a Mix: first pick a rule, then pick its song from the Mix's source, so that the rule is bound to a real track.
25. As a user, I want the same rule to carry a different song in each Mix, so that rules stay reusable.
26. As a user, I want up to MAX_RULES_PER_MIX rules per Mix (default 10), with "+ Add rule" hidden at the cap, so that Mixes stay manageable.
27. As a user, I want to drag rules to reorder them, with live #01/#02 numbering and a live Preview, so that I can set priority.
28. As a user, I want each rule in a Mix to get its own colour by position, from a 10-colour palette, so that I can match rules to Preview dots.
29. As a user, I want to remove a rule from a Mix, so that I can unblock deleting it or simplify the Mix.
30. As a user, I want a "Keep base order" option, defaulting to off (seeded shuffle), so that I choose between variety and the source's order (ADR-0004).
31. As a user, I want a Reshuffle action that changes the stored seed, so that I can get a new base order on demand while results stay stable otherwise.
32. As a user, I want rule songs removed from the Base list, so that they only play where a rule puts them (ADR-0005).
33. As a user, I want to rename and delete Mixes, so that I can maintain my list.

### Preview
34. As a user, I want the Preview drawn as dots joined by a line, one dot per song, coloured by rule with a tiny #n, so that I see exactly where each rule lands.
35. As a user, I want Repeat shown as one dot with a self-loop and "N×", so that back-to-back repeats are clear (ADR-0003).
36. As a user, I want a "moved from #p" badge on songs that were shifted by a conflict, so that I understand why a song isn't where its rule wanted it (ADR-0006).
37. As a user, I want a summary such as "514 tracks · 3 rules applied", with the true total, so that I know the playlist's size.
38. As a user, I want "N songs skipped (unavailable)" when the source has unavailable tracks, so that I know why the count differs (ADR-0011).
39. As a user, I want a warning on a rule whose song is unavailable, so that I can pick another song.
40. As a user, I want Regenerate to update only the Preview, so that nothing is written until I decide (ADR-0013).
41. As a user, I want to see song names and artists in the Preview and pickers, so that I recognise the tracks.

### Saving to Spotify
42. As a user, I want "Save to Spotify" to create `Rules: <mix name>` (private) on the first save, so that I get a playable playlist.
43. As a user, I want later saves to overwrite the same Target playlist, tracked by ID, so that renaming it in Spotify is safe (ADR-0015).
44. As a user, I want progress shown while reading and writing large playlists, so that I know it's working (ADR-0017).
45. As a user, I want the app to recreate the Target if I deleted it, store the new one, and tell me it was recreated (ADR-0016).
46. As a user, I want a success toast ("Saved "Rules: Gym" to Spotify. Play it with shuffle off.") and a clear error with retry on failure, so that I know the outcome.
47. As a user, I want the tip "Play with shuffle off. Saving while it's playing may skip ahead." near Save (ADR-0018).
48. As a user, I want rate limits (429) handled automatically with backoff, so that saves succeed without me retrying.

### Empty states
49. As a new user, I want "No mixes yet" with guidance, and "No rules yet. Without one, you just get a copy.", so that I know what to do.

## Implementation Decisions

### Modules (ADR-0001)
- **packages/rules-engine**: pure TypeScript with no I/O, clock or unseeded randomness. This is the deep module; most of the logic and tests live here.
- **packages/spotify**: Spotify integration, server-side only. It covers:
  - authorization code + PKCE with token refresh;
  - an HTTP client with Bearer auth, refresh on 401, and 429 backoff using Retry-After;
  - paged readers for the source picker (owned + collaborative only), playlist items and Liked Songs;
  - a writer that creates the target, replaces it in 100-item PUT then POST chunks, detects a missing target, and reports progress.
  
  All endpoint knowledge lives here (research §3.2, post-Feb-2026 names: `/playlists/{id}/items`, `POST /me/playlists`).
- **apps/web**: Next.js (App Router). Route handlers handle auth and data, plus a Supabase data layer. UI is Tailwind v4, shadcn/ui and Framer Motion, styled after mockup v3.
- **Supabase Postgres**: storage keyed by Spotify user (ADR-0008). Hosted on Vercel, free tiers only.

### Rule engine interface
- `build(source, mix, seed) -> { uris, preview, issues, stats }`, plus `validate(mix)`.
- Inputs:
  - the source items, which may contain null or unavailable entries;
  - the ordered bound rules `{ kind: pin_first | every_n(n) | repeat(times), uri }`;
  - the base order mode `shuffle | source`;
  - the seed.
- The collision policy is fixed to remove-from-base (ADR-0005) and the conflict policy is fixed to shift (ADR-0006, ADR-0012). Neither is a user option.
- Steps:
  1. Drop unavailable items and count them (ADR-0011).
  2. Apply a seeded shuffle (Fisher–Yates + seeded PRNG) unless the mode is `source`.
  3. Remove rule songs from the base.
  4. Compute the final length L = B + the sum of rule counts. Pin = 1, Every N = floor(B/N), Repeat = N.
  5. Claim slots in priority order. A taken slot shifts to the next free slot, recording `shiftedFrom`.
  6. Fill the remaining slots with the base, in order.
- **Every N** uses final-slot positions k·(N+1)−1 (research §4.1, ADR-0007).
- **Repeat N** claims N consecutive slots (ADR-0003). The block's start slot is an assumption; see A1.
- A rule whose song is unavailable produces a warning issue and places nothing (assumption A2).
- Output:
  - `preview`: one entry per slot `{uri, ruleIndex|null, shiftedFrom?}`;
  - `stats`: `{total, rulesApplied, skippedUnavailable}`;
  - `issues`: warnings.
- Deterministic: the same inputs and seed always give the same output.

### Shared fixtures (ADR-0002)
- Engine test cases are stored as JSON (input + expected output) in the engine package.
- The TS tests consume them, and the future Kotlin port must pass the same files.

### Limits (ADR-0017)
- Env vars `MAX_RULES_PER_MIX` (default 10) and `MAX_SOURCE_TRACKS` (default 600), enforced server-side and shown in the UI.
- Writes go in 100s. Reads are paged at Spotify's maximum page size (50 for playlist items and Liked Songs per research §3.2, so "100s" applies to writes; see A6).
- Progress is reported per page.

### Auth (ADR-0009)
- Route handlers start the login (PKCE verifier + state stored server-side or in a short-lived signed cookie) and handle the callback.
- Scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-private, user-library-read.
- The refresh token is stored encrypted (an app-level key in server env) in Supabase. The browser gets an httpOnly, Secure, SameSite session cookie that maps to the user row.
- Track `authorized_at` for the 6-month re-auth limit.

### Data model (Supabase)

**users**
- `id` (PK, the Spotify user id from `/me`)
- `account_id` (the newer `/me` account id when present, A3)
- `display_name`
- `refresh_token_encrypted`
- `access_token`, `access_token_expires_at` (optional cache)
- `scopes`
- `authorized_at`
- `created_at`

**sessions**
- `id_hash` (PK, sha256 of the cookie value)
- `user_id`
- `expires_at`
- `created_at`

**rules** (library, song-less)
- `id`
- `user_id`
- `kind` (pin_first | every_n | repeat)
- `n` (null for pin_first)
- `pinned`
- `archived_at`
- `created_at`, `updated_at`

**mixes**
- `id`
- `user_id`
- `name`
- `source_type` (playlist | liked)
- `source_playlist_id` (null for Liked Songs)
- `source_name` (display name for Home)
- `keep_source_order` (bool, default false)
- `shuffle_seed`
- `target_playlist_id` (nullable)
- `last_saved_at`
- `last_snapshot_id`
- `created_at`, `updated_at`

**mix_rules**
- `id`
- `mix_id`
- `rule_id` (FK, `NO ACTION DEFERRABLE INITIALLY DEFERRED`: deleting a rule in use still fails with 23503, while deleting a user cascades through rules and mixes in one statement)
- `position`
- `track_uri`

Constraints:
- `position` is unique per Mix.
- The count per Mix is limited by MAX_RULES_PER_MIX in the app.

**save_runs**
- `id`
- `mix_id`
- `started_at`, `finished_at`
- `updated_at` (heartbeat, bumped on each progress update; a running run with no heartbeat for 5 minutes is marked failed)
- `status`
- `error`
- `phase`
- `done`
- `total`
- `tracks_written`
- `recreated` (bool)
- `retries_429`

Constraints:
- At most one `running` run per Mix (partial unique index `save_runs_one_running`).

**track_cache** (short-lived preview labels)
- `uri`
- `name`
- `artists`
- `fetched_at`

Every row is scoped by user, and access goes through server route handlers with a service role. Enabling Row Level Security is still recommended (A4).

### API contract (route handlers, JSON)
- **Auth:** login, callback, logout, me.
- **Sources:**
  - list (owned + collaborative playlists + Liked Songs, with track counts);
  - get the items of a source (refused above MAX_SOURCE_TRACKS).
- **Rules:** CRUD. Delete returns 409 with the count of Mixes using the rule. Archive, pin.
- **Mixes:** CRUD. Rules within a Mix can be added, reordered, removed and have their song set.
- **Reshuffle:** generates a new seed.
- **Preview:** the server reads the source and runs the engine. Regenerate calls this.
- **Save:** runs the engine, then writes the target (creating or recreating it if missing) as a background run. It returns `{ runId }`, and the run's status endpoint is polled every 1 second (A5).

### Save algorithm
1. If there is no `target_playlist_id`, or the stored target no longer exists or isn't followed, create `Rules: <mix name>` (private) and store the id. If this is a recreation, set `recreated=true`.
2. PUT the first 100 URIs.
3. POST the rest in chunks of 100.
4. Store the `snapshot_id` and write a `save_runs` row.

An empty result clears the target.

### UI
- Screens follow mockup v3: sign-in, Home (Mixes), Mix builder, Rules library, Rule editor, rule and song picker sheets, delete dialog.
- Differences from the mockup:
  - the Preview uses shift + badge (ADR-0012);
  - there is no "Remove rule songs from base" toggle, because it's always on (ADR-0005; the mockup's toggle is dropped);
  - there are separate Regenerate and Save to Spotify buttons (ADR-0013), with green on Save only;
  - up to 10 rule colours (ADR-0017);
  - the shuffle tip appears near Save.
- Copy comes from the design copy deck.
- Motion is about 200ms and respects reduced-motion (design Motion section).
- One SVG dot renderer serves both the editor and the Preview.

## Testing Decisions
- Good tests check external behaviour through public interfaces (inputs → outputs, HTTP in → HTTP out), not internals.
- **rules-engine (primary seam):**
  - example tests driven by the shared JSON fixtures;
  - property-based tests with fast-check over random bases (0–600 items, with duplicates and nulls) and 0–10 rules.
  
  Properties:
  - length = B + rule counts;
  - every base song appears exactly once;
  - each rule's song count matches its rule;
  - the pin is at slot 0 unless a higher rule took it;
  - Repeat copies are consecutive unless shifted;
  - determinism for a fixed seed;
  - shifted entries carry `shiftedFrom`;
  - unavailable items are excluded and counted.
- **spotify package (second seam):** tests against recorded HTTP fixtures or a fake server. They cover:
  - pagination;
  - PUT then POST chunking at 99, 100, 101 and 250 tracks;
  - 401 refresh;
  - 429 Retry-After backoff;
  - missing-target detection and recreation;
  - null item handling.
- **web:** route-handler integration tests against a test Supabase database for:
  - auth (session cookie, encrypted token);
  - rule delete returning 409 when in use;
  - the rule limit;
  - the source size refusal.

  A thin Playwright smoke test covers the main flow with Spotify mocked.
- Prior art: none in the repo yet. The duplicates spike (spikes/duplicates/) is the only live Spotify evidence.
- Workflow: TDD; typecheck + tests must pass before every commit (AGENTS.md).

## Out of Scope
- Android/Kotlin app (only the shared JSON fixtures are prepared).
- Nightly or scheduled regeneration.
- Two-dashboard design and user-defined rule types.
- Public launch or extended quota.
- Followed / Spotify-made sources.
- Skip-every-N or any song-less rule.
- Live playback control.
- Diff/reorder-based writes.
- Paid tiers (ask before spending).
- Notifying the UI Designer (later, per ADR-0012).

## Further Notes / Risks
- Duplicates are confirmed to work (ADR-0010).
- Autoplay after the last track, saving mid-play, the 6-month refresh-token expiry, the dev-mode 5-user cap, and the unknown Premium requirement for end users all stand (research §9).
- `/me` no longer returns `product`; research suggests `account_id` as the stable key (see A3).

## Confirmed decisions

Approved by Nishchay on 2026-10-16. They were previously listed as assumptions A1–A11, and those IDs are kept for reference.
- **A1 Repeat placement.** The N back-to-back copies start at the song's desired slot. The mockup inserts at the song's original position in the source, scaled to the final list, or at slot 6 if absent; that is illustrative only. The spec uses: the start slot is the song's index in the (ordered) source before removal, clamped to fit.
- **A2 Unavailable rule song.** The rule places nothing and shows the warning, and the rest of the Mix still builds.
- **A3 User key.** ADR-0008 says "Spotify user id". Research says `/me` now exposes `account_id` (May 2026) as the stable key. The spec keys on the `/me` `id`, with `account_id` stored too if present.
- **A4 Data access.** Server-only access with a service role, plus RLS enabled as defence in depth.
- **A5 Progress transport.** Save starts a run and returns its `save_runs` id immediately. The browser polls the run's status endpoint every 1 second until the status is `succeeded` or `failed`. The `save_runs` row stores `phase` (reading | writing | done), `done` and `total`, and these drive the progress display.
- **A6 Read page size.** Reads use Spotify's maximum (50 for playlist items and Liked Songs per research). ADR-0017 says 100s, so the spec applies 100 to writes.
- **A7 Collision toggle dropped.** ADR-0005 makes remove-from-base fixed, so the mockup's toggle is removed.
- **A8 Scopes.** The four scopes from the plan, without playlist-modify-public, because targets are private.
- **A9 Disabled rules.** Research's `enabled` flag on a Mix rule isn't in any decision, so it is omitted.
- **A10 Shift direction.** "Next free slot" searches forward first, then backward if none is free.
- **A11 Mix rename.** Renaming a Mix does not rename the existing Target playlist (ADR-0015). The default name applies at creation or recreation only.
