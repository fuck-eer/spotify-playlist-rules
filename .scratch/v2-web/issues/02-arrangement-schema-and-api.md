# 02: Arrangement storage, Mix state endpoint, Source sync, album art

**What to build:** the server stores a Mix's Manual order, Bench and deleted copies, serves everything a client needs to build the graph locally, and prunes songs deleted from the Source.

**Blocked by:** 01

**Status:** ready-for-agent

**Glossary:** Manual order, Bench, Rule copy, Source sync, Source playlist. **ADRs:** 0028, 0030.

**Files**
- `supabase/migrations/0006_arrangement.sql`: columns exactly as spec "Data model (migration 0006)" (all of them, including `track_cache.image_url` and `sessions.kind`, so Android needs no second migration).
- `packages/spotify/src/readers.ts`: `TrackItem` gains `imageUrl: string | null` (the album image closest to 300 px wide, else first, else null); `ITEM_FIELDS` and the Liked Songs fields include `album(images)`. Fake Spotify returns images.
- `apps/web/lib/source-tracks.ts`: cache `image_url`.
- `apps/web/lib/db/arrangement-repo.ts`: `getArrangement(sql, userId, mixId): Promise<Arrangement | null>`; `putArrangement(sql, userId, mixId, input: ArrangementInput): Promise<{ version: number } | { conflict: true }>` (one transaction: check `arrangement_version`, write mixes + mix_rules, delete Repeat Mix rules whose `n - removed_plays <= 1`, bump version); `pruneToSource(sql, mixId, availableUris: Set<string>): Promise<boolean>`.
  ```ts
  type Arrangement = { manualOrder: string[] | null; bench: string[]; version: number;
    rules: { id: string; removedPlays: number; deletedCopies: number[] }[] };
  type ArrangementInput = Omit<Arrangement, "version"> & { version: number };
  ```
- `apps/web/lib/mix-state.ts`: `getMixState(sql, userId, mixId, client): Promise<MixState>` (reads Source, prunes, returns spec shape).
- `apps/web/app/api/mixes/[id]/state/route.ts` (GET), `apps/web/app/api/mixes/[id]/arrangement/route.ts` (PUT, zod-validated: URIs `spotify:track:`, lengths ≤ MAX_SOURCE_TRACKS, rule ids belong to the Mix), `apps/web/app/api/mixes/[id]/reset-order/route.ts` (POST). `reshuffle` route clears `manual_order` and keeps Bench/deletions.

**Acceptance criteria**
- [ ] Route tests (route harness + test DB + fake Spotify): state shape; prune drops a URI deleted from the Source from both arrays and bumps version; PUT 200 bumps version; stale version → 409 with current state; another user's Mix → 404; bad URI → 422; Repeat reaching 1 play deletes the Mix rule; reshuffle clears order, keeps bench; reset-order clears order, keeps seed.
- [ ] Migration test in `lib/db/schema.test.ts` covers new columns and checks.
- [ ] Spotify reader tests cover `imageUrl` selection.
