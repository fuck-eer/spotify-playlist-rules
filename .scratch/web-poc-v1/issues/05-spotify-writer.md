# 05: Spotify package: Target playlist writer

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 04
**Glossary terms:** Target playlist, Save to Spotify, Mix
**Refs:** plan "How it works" 3–4; ADR-0010, 0015, 0016, 0017; research §3.3

## What to build
Writing an engine result into a Mix's Target playlist: create it if it doesn't exist, recreate it if it was deleted or unfollowed, replace its contents in chunks of 100, and report progress. Tested against fake-spotify.

## Files
- `packages/spotify/src/writer.ts`, exported from `index.ts`
- `packages/spotify/src/writer.test.ts`

## Exported interface (exact)
```ts
export const WRITE_CHUNK = 100;
export interface WriteTargetInput { targetPlaylistId: string | null; defaultName: string /* "Rules: <mix name>" */; uris: string[]; onProgress?: (done: number, total: number) => void }
export interface WriteTargetResult { playlistId: string; snapshotId: string; recreated: boolean; created: boolean; tracksWritten: number }
export function targetName(mixName: string): string; // returns `Rules: ${mixName}`
export function writeTarget(c: SpotifyClient, input: WriteTargetInput): Promise<WriteTargetResult>;
```

## Behaviour (exact)
1. **Check whether the target exists:** if `targetPlaylistId` is set, call `GET /playlists/{id}/followers/contains`. It is missing if the response is 404 or 403, or if the body is `[false]` (the user unfollowed or deleted it).
2. **Create the playlist** if `targetPlaylistId` is null or the target is missing: `POST /me/playlists` with `{ name: defaultName, public: false, description: "Made by rulemix. Play with shuffle off." }`.
   - Set `created = true`.
   - Set `recreated = true` only if a `targetPlaylistId` had been given (ADR-0016).
   - The playlist is never renamed afterwards (ADR-0015).
3. **Replace:** `PUT /playlists/{id}/items` with `{ uris: uris.slice(0,100) }` (an empty list clears the playlist). Then `POST /playlists/{id}/items` with each following 100-item chunk, in order.
4. **Progress:** call `onProgress(written, uris.length)` after each chunk.
5. **Snapshot:** `snapshotId` = the `snapshot_id` from the last write response.

## Tests (write first)
- No target id: it creates the playlist (check the request body), PUTs 3 uris, and returns `created=true, recreated=false`.
- An existing target that is followed: no create call, and the PUT goes to the existing id.
- A target that returns 404, 403 or `[false]` is recreated, giving `recreated=true` and a new id.
- Chunking checks the exact call sequence and chunk sizes:
  - 0 → PUT []
  - 99 → PUT 99
  - 100 → PUT 100
  - 101 → PUT 100 + POST 1
  - 250 → PUT 100 + POST 100 + POST 50
- Duplicate uris are sent unchanged (ADR-0010).
- Progress calls for 250 uris are (100,250), (200,250), (250,250).
- `targetName("Gym") === "Rules: Gym"`.

## Acceptance criteria
- [ ] Exported exactly as above; all tests pass offline
