# 12: Save to Spotify with progress, recreate note, shuffle tip

**Status:** done (pending Nishchay's manual check against real Spotify)
**Type:** task
**Blocked by:** 05, 11
**Glossary terms:** Save to Spotify, Target playlist, Mix, Preview
**Refs:** ADR-0013, 0015, 0016, 0017, 0018; spec "Save algorithm", A5 (polling every 1s), A11; mockup builder Generate button + toast (green primary)
**Env vars:** Spotify and database vars, `MAX_SOURCE_TRACKS`

## What to build
In the Mix builder, the green primary button "Save to Spotify" starts a save. A progress bar follows reading and then writing, polled every 1 s. On success a toast shows `Saved "Rules: Gym" to Spotify. Play it with shuffle off.`, with " It was recreated because the old one was gone." appended when the Target was recreated. On failure, a toast shows "Couldn't create the playlist. Check your connection and retry." with a Retry action. The tip "Play with shuffle off. Saving while it's playing may skip ahead." sits under the button. Home shows the new last-saved time.

## Files
- `apps/web/lib/db/save-runs-repo.ts`:
  ```ts
  export interface SaveRunRow { id: string; mixId: string; status: "running"|"succeeded"|"failed"; phase: "reading"|"writing"|"done"; done: number; total: number; tracksWritten: number; recreated: boolean; retries429: number; error: string | null; startedAt: string; finishedAt: string | null }
  export function startRun(sql, mixId): Promise<SaveRunRow>;
  export function getRunningRun(sql, mixId): Promise<SaveRunRow | null>;
  export function updateRun(sql, id, patch: Partial<Pick<SaveRunRow,"phase"|"done"|"total"|"tracksWritten"|"recreated"|"retries429">>): Promise<void>;
  export function finishRun(sql, id, result: { status: "succeeded" | "failed"; error?: string }): Promise<void>;
  export function getRun(sql, userId, mixId, runId): Promise<SaveRunRow | null>; // user-scoped via mixes
  ```
- `apps/web/lib/save.ts`: `export async function performSave(sql, userId, mixId, runId, client): Promise<void>`.
  1. Set the phase to `reading` and read the source with progress, calling `updateRun` with done/total.
  2. Run `build`.
  3. Set the phase to `writing` and call `writeTarget(client, { targetPlaylistId: mix.targetPlaylistId, defaultName: targetName(mix.name), uris, onProgress })`, which updates the run with done/total.
  4. Update the Mix: `target_playlist_id` (the new id if recreated), `last_saved_at = now()` and `last_snapshot_id`.
  5. Finish the run as succeeded, with `recreated`, `tracksWritten` and `retries429 = client.stats.retries429`.

  Any error finishes the run as failed. `error` is a user-safe message:
  - `SpotifyAuthError` → "Spotify access expired. Sign in again."
  - `source_too_large` → its message
  - anything else → "Couldn't create the playlist. Check your connection and retry."

  The Mix is never renamed in Spotify (A11).
- Routes:
  - `app/api/mixes/[id]/save/route.ts` (POST):
    - If a run is already `running` for this Mix, return 409 `save_in_progress` with `{ runId }`.
    - Otherwise call `startRun`, schedule `performSave` with `after()` from `next/server`, and return 202 `{ runId }`.
  - `app/api/mixes/[id]/save/[runId]/route.ts` (GET) returns `{ run: SaveRunRow }` or 404.
- Components (`mix-builder.tsx`, footer):
  - A "Save to Spotify" button: the only `#1DB954` element on the screen (green only on the primary action). It is disabled while a run is in progress.
  - The tip text below it in mono dim: "Play with shuffle off. Saving while it's playing may skip ahead." (ADR-0018).
  - While running, a shadcn `Progress` bar shows `phase === "reading" ? "Reading {done}/{total}" : "Writing {done}/{total}"`. Poll `GET …/save/{runId}` every 1000 ms with `setInterval`, cleared when the status isn't `running` or the component unmounts (A5).
  - Toasts use sonner, with the copy given above. The toast name uses `targetName(mix.name)`.
  - "Regenerate" (ticket 11) stays a separate secondary button (ADR-0013).

## Tests (write first)
- `save-runs-repo.test.ts`: lifecycle; `getRun` is user-scoped.
- `save.test.ts` (fake-spotify + test database):
  - first save → creates the playlist and stores `target_playlist_id`, `recreated=false`;
  - second save → no create call, PUT to the same id;
  - a target that returns 404 → recreated, the new id is stored, `recreated=true`;
  - 250 output tracks → PUT 100 + POST 100 + POST 50, `tracksWritten=250`, and the run's done/total end at 250/250;
  - a token refresh failure → failed with "Spotify access expired. Sign in again.";
  - a 429 once → `retries429=1` and succeeded.
- `save-route.test.ts`: POST returns 202 with a runId; a second POST while running → 409; GET of another user's run → 404.
- `mix-builder-save.test.tsx` (fake timers):
  - polls every 1000 ms and stops on succeeded;
  - success toast text, with the recreated variant;
  - failure toast with Retry;
  - the tip text is present.
- `e2e/save.spec.ts` (seeded session + fake-spotify): Liked Songs mix + a Pin first rule → Save to Spotify → success toast → Home shows the relative saved time.

## Acceptance criteria
- [x] Writing happens only through Save to Spotify
- [x] One Target per Mix, tracked by id; recreated when missing, with a note
- [x] Progress updates via 1 s polling; all tests pass
- [ ] Manual check by Nishchay against real Spotify: a playlist "Rules: <mix>" appears with the expected order

## Notes (implementation)
- `targetName` moved to `packages/spotify/src/names.ts`, exported as `@rulemix/spotify/names` (browser-safe; the package index pulls `node:crypto` into client bundles). `writer.ts` re-exports it.
- The failure toast shows the run's own user-safe error (generic copy, or "Spotify access expired. Sign in again." / the source-too-large message), with Retry.
- A 409 `save_in_progress` from POST resumes polling that run. The 409 body is `{ error: { code, message }, runId }`.
- Switch "on" and the progress bar use white, so the Save button is the only #1DB954 element.
- On success the builder calls `router.refresh()` so Home shows the new saved time.
- Known limit: a run left "running" by a crashed server blocks new saves for that Mix (no stale-run timeout yet).
- Test helper `lib/testing/fake-writes.ts` serves create / library-contains / replace / append; the e2e fake server installs it.
