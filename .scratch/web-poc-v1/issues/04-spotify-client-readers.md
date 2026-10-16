# 04: Spotify package: HTTP client, auth helpers, readers

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Glossary terms:** Source playlist, Unavailable track
**Refs:** research §3.1–3.4; ADR-0009, 0010, 0011, 0014, 0017; spec A6, A8
**Env vars:** none read directly. Base URLs are passed in through config, which apps/web fills from `SPOTIFY_ACCOUNTS_BASE_URL` and `SPOTIFY_API_BASE_URL`.

## What to build
A server-side Spotify library: building the PKCE authorize URL, exchanging and refreshing tokens, an API client that handles refresh on 401 and 429 backoff, and paged readers for the source picker, playlist items and Liked Songs. It is tested against a fake HTTP server, and nothing in it touches real Spotify.

## Files
- `packages/spotify/src/errors.ts`, `config.ts`, `pkce.ts`, `oauth.ts`, `client.ts`, `readers.ts`, `index.ts` (remove `SPOTIFY_PACKAGE` and its test)
- `packages/spotify/test/fake-spotify.ts`: a tiny `node:http` server with programmable routes (`fake.on(method, pathRegex, handler)`), a `fake.calls` log, a `fake.url`, and `close()`.
- tests: `src/pkce.test.ts`, `src/oauth.test.ts`, `src/client.test.ts`, `src/readers.test.ts`

## Exported interface (exact)
```ts
export const SCOPES = ["playlist-read-private","playlist-read-collaborative","playlist-modify-private","user-library-read"] as const; // A8
export interface SpotifyConfig { clientId: string; clientSecret: string; redirectUri: string; accountsBaseUrl: string; apiBaseUrl: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> }
export class SpotifyError extends Error { status: number; body: unknown }
export class SpotifyAuthError extends SpotifyError {}
export class SpotifyForbiddenError extends SpotifyError {}
export class SpotifyNotFoundError extends SpotifyError {}
export class SpotifyRateLimitError extends SpotifyError {}
export class SpotifyHttpError extends SpotifyError {}
export function createPkcePair(): { verifier: string; challenge: string };      // verifier 64 base64url chars; challenge = base64url(sha256(verifier))
export function buildAuthorizeUrl(cfg: SpotifyConfig, p: { state: string; challenge: string }): string; // response_type=code, code_challenge_method=S256, scope = SCOPES joined by space
export interface TokenSet { accessToken: string; refreshToken: string; expiresAt: number /* epoch ms */; scope: string }
export function exchangeCode(cfg: SpotifyConfig, p: { code: string; verifier: string }): Promise<TokenSet>; // POST {accounts}/api/token, Basic auth, grant_type=authorization_code
export function refreshAccessToken(cfg: SpotifyConfig, refreshToken: string): Promise<TokenSet>; // keeps old refreshToken if response omits it; invalid_grant -> SpotifyAuthError
export interface TokenStore { get(): Promise<TokenSet>; set(t: TokenSet): Promise<void> }
export interface SpotifyClient { request<T>(method: "GET"|"POST"|"PUT"|"DELETE", path: string, body?: unknown): Promise<{ status: number; data: T }>; readonly stats: { requests: number; retries429: number } }
export function createClient(cfg: SpotifyConfig, store: TokenStore): SpotifyClient;
export interface Me { id: string; accountId: string | null; displayName: string | null }
export function getMe(c: SpotifyClient): Promise<Me>;
export interface SourceOption { type: "playlist" | "liked"; id: string | null; name: string; trackCount: number; imageUrl: string | null; ownerName: string }
export function listSources(c: SpotifyClient, meId: string): Promise<SourceOption[]>; // Liked Songs first, then owned + collaborative playlists in API order; followed hidden (ADR-0014)
export type ReadProgress = (done: number, total: number) => void;
export interface TrackItem { uri: string; name: string; artists: string[] }
export function readPlaylistItems(c: SpotifyClient, playlistId: string, onProgress?: ReadProgress): Promise<(TrackItem | null)[]>;
export function readLikedSongs(c: SpotifyClient, onProgress?: ReadProgress): Promise<(TrackItem | null)[]>;
export function getSourceTrackCount(c: SpotifyClient, source: { type: "playlist" | "liked"; id: string | null }): Promise<number>;
```

## Behaviour (exact)
- **Client:**
  - Before each request, an access token expiring within 60 s triggers a refresh, which is saved through `store.set`.
  - A 401 triggers one refresh and one retry; a second 401 throws `SpotifyAuthError`.
  - A 429 waits `Retry-After` seconds (default 1 if the header is missing) through `cfg.sleep`. It retries up to 5 times, incrementing `stats.retries429` each time, then throws `SpotifyRateLimitError`.
  - 403 → `SpotifyForbiddenError`; 404 → `SpotifyNotFoundError`; any other status ≥400 → `SpotifyHttpError`. 204 or an empty body gives `data` = null.
  - `path` is relative to `apiBaseUrl`, and query strings are allowed.
- **getMe:** `GET /me`. `accountId` = `account_id ?? null`.
- **listSources:**
  - Liked Songs comes from `GET /me/tracks?limit=1` (its `total`), shown with name "Liked Songs", `ownerName` = the display name or id.
  - Playlists come from `GET /me/playlists?limit=50&offset=k`. Keep a playlist where `owner.id === meId || collaborative === true`.
  - `trackCount` = `items.total` (fall back to `tracks.total` if missing). `imageUrl` = `images[0].url ?? null`.
- **readPlaylistItems:**
  - `GET /playlists/{id}/items?limit=50&offset=k&fields=total,next,items(is_local,item(uri,name,type,artists(name)),track(uri,name,type,artists(name)))`.
  - Use `item ?? track` for each entry. It becomes `null` if missing, if `is_local` is set, if `type !== "track"`, or if the uri is null (ADR-0011).
  - Call `onProgress(doneSoFar, total)` after each page. Page size is 50, Spotify's maximum (A6).
- **readLikedSongs:** `GET /me/tracks?limit=50&offset=k`, same mapping.
- **getSourceTrackCount:** playlist → `GET /playlists/{id}?fields=items(total),tracks(total)`; liked → `GET /me/tracks?limit=1` (`total`).

## Tests (write first, all against fake-spotify)
- `pkce.test.ts`:
  - the verifier is 64 chars from the base64url charset;
  - the challenge matches the RFC 7636 test vector (verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`; test this through an exported internal `challengeFor(verifier)`).
- `oauth.test.ts`:
  - the authorize URL has the exact query params;
  - `exchangeCode` sends Basic auth and the form body, and maps `expires_in` to `expiresAt` (with an injected clock via `vi.useFakeTimers`);
  - `refreshAccessToken` keeps the old refresh token when it's omitted;
  - `invalid_grant` → `SpotifyAuthError`.
- `client.test.ts`:
  - a proactive refresh when the token is near expiry;
  - a 401 refreshes and retries once;
  - a double 401 → `SpotifyAuthError`;
  - a 429 with `Retry-After: 2` calls sleep(2000) and then succeeds, with `retries429 === 1`;
  - six 429s → `SpotifyRateLimitError`;
  - 403/404/500 map to the right classes;
  - 204 → null.
- `readers.test.ts`:
  - 120 items paginate in 3 calls and progress is called with (50,120), (100,120), (120,120);
  - null, local and episode entries become null;
  - the deprecated `track` field is used when `item` is missing;
  - `listSources` filters out a followed playlist, keeps owned and collaborative ones, and puts Liked first;
  - `getSourceTrackCount` works for both source types.

## Acceptance criteria
- [ ] The interface above is exported exactly from `@rulemix/spotify`
- [ ] All tests pass offline; no real network
- [ ] No tokens are logged anywhere
