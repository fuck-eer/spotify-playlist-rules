# 06: Sign in with Spotify (server-side auth vertical)

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 03, 04
**Glossary terms:** none beyond user/session
**Refs:** ADR-0009; spec stories 1–7; mockup sign-in screen (`docs/design/DSN-20261016-playlist-rules/index.html`, sign-in phone; `desktop.png` leftmost)
**Env vars:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_ACCOUNTS_BASE_URL`, `SPOTIFY_API_BASE_URL`, `APP_URL`, `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`

## What to build
A user opens the app, taps "Continue with Spotify", authorizes, and lands on Home (`/mixes`) signed in. Tokens are stored encrypted server-side, and the browser holds only an httpOnly session cookie. Sign-out works. Pages other than the sign-in page redirect to `/` when there is no session.

## Files
- `apps/web/lib/crypto.ts`:
  - `encrypt(plain: string): string` and `decrypt(token: string): string`, using AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (base64, must decode to 32 bytes). The output format is `v1.<iv b64url>.<tag b64url>.<ciphertext b64url>`, with a 12-byte random iv.
  - `sign(value: string): string` and `verifySigned(signed: string): string | null`, using HMAC-SHA256 with `SESSION_SECRET` in the format `<value>.<sig b64url>`.
- `apps/web/lib/spotify-config.ts`: `export function spotifyConfig(): SpotifyConfig`, built from env.
- `apps/web/lib/auth/session.ts`:
  - `SESSION_COOKIE = "rulemix_session"` and `SESSION_TTL_DAYS = 30`;
  - `createSession(sql, userId): Promise<string /*raw cookie value*/>`, using 32 random bytes in base64url and storing the sha256 hex in `sessions.id_hash`;
  - `getSessionUser(sql, rawCookie: string | undefined): Promise<{ id: string; displayName: string | null } | null>`, which ignores expired sessions;
  - `destroySession(sql, rawCookie)`;
  - `requireUser(): Promise<{ id: string; displayName: string | null }>` for route handlers and server components. It reads `cookies()`; route handlers get a 401 JSON error and pages get `redirect("/")`. Export two variants: `requireUserApi` (throws `HttpError(401)`) and `requireUserPage` (redirects).
- `apps/web/lib/auth/token-store.ts`: `export function dbTokenStore(sql, userId): TokenStore` decrypts and encrypts `users.refresh_token_encrypted` and caches the access token columns.
- `apps/web/lib/http.ts`:
  - `class HttpError extends Error { status: number; code: string }`;
  - `export function jsonError(e: unknown): Response`. It maps HttpError to its status, `SpotifyAuthError` to 401 `reauth_required`, and anything else to 500 `internal`. The body is `{ error: { code, message } }`.
- Routes:
  - `apps/web/app/api/auth/login/route.ts` (GET):
    1. Create a PKCE pair and a state of 16 random bytes in base64url.
    2. Set the cookie `rulemix_oauth` = `sign(JSON.stringify({state, verifier}))` (httpOnly, SameSite=Lax, maxAge 600, path `/api/auth`).
    3. Return a 302 to `buildAuthorizeUrl`.
  - `apps/web/app/api/auth/callback/route.ts` (GET):
    1. Verify the cookie and check that `state` matches. On a mismatch, or if the cookie is missing, return a 302 to `/?error=state`. If Spotify returned `error`, return a 302 to `/?error=denied`.
    2. Call `exchangeCode`, then `getMe`.
    3. Upsert the user: id, account_id, display_name, the encrypted refresh token, scopes, and `authorized_at = now()`.
    4. Create a session and set `rulemix_session` (httpOnly, SameSite=Lax, Secure when `APP_URL` starts with https, maxAge 30d, path `/`).
    5. Clear `rulemix_oauth` and return a 302 to `/mixes`.
  - `apps/web/app/api/auth/logout/route.ts` (POST): destroy the session, clear the cookie, and return a 302 to `/`.
  - `apps/web/app/api/me/route.ts` (GET): returns `{ id, displayName }` or 401.
- Pages:
  - `apps/web/app/page.tsx` is the sign-in screen, following the mockup. It shows:
    - the logo: a white 3×3 tile grid plus the lowercase wordmark "rulemix";
    - the tagline "Your playlist, your order. Spotify just plays it.";
    - a "Continue with Spotify" button linking to `/api/auth/login`;
    - the note "Dev mode: access is limited to the owner and 4 friends."

    `?error=denied|state` shows "Sign-in didn't finish. Try again.". A signed-in user is redirected to `/mixes`.
  - `apps/web/app/mixes/page.tsx` is a placeholder that ticket 08 replaces. It calls `requireUserPage()` and renders "Mixes" plus a sign-out button (a form POST to `/api/auth/logout`).
- `apps/web/components/logo.tsx`: the `Logo` component, an SVG 3×3 grid (9 white squares, 3px gap) followed by the wordmark.

## Tests (write first)
- `crypto.test.ts`:
  - encrypt/decrypt round-trip;
  - the same plaintext gives a different ciphertext each time;
  - a tampered ciphertext throws;
  - a wrong key length throws;
  - sign/verify works, and a tampered value returns null.
- `session.test.ts` (test database):
  - create → get returns the user;
  - an expired session returns null;
  - destroy → null;
  - only the hash is stored (the raw value doesn't appear in the table).
- `auth-routes.test.ts`:
  - Call the route handlers directly with `Request` objects. Use fake-spotify from `packages/spotify/test` (export it through a package subpath `@rulemix/spotify/testing`) and set `SPOTIFY_*_BASE_URL` to it.
  - login sets a signed cookie and redirects to the authorize URL containing the 4 scopes;
  - a callback with a bad state redirects to `/?error=state`;
  - a happy-path callback upserts the user with an encrypted (≠ raw) refresh token, sets `rulemix_session`, and redirects to `/mixes`;
  - logout clears the cookie;
  - `/api/me` returns 401 without a cookie.
- `apps/web/e2e/auth.spec.ts`: an unauthenticated visit to `/mixes` redirects to `/`, and the sign-in copy is visible.

## Acceptance criteria
- [ ] The full sign-in works against real Spotify locally with `.env.local` (manual check by Nishchay; the redirect URI `http://127.0.0.1:3000/api/auth/callback` is registered)
- [ ] No token appears in the browser (cookies hold only an opaque id), in logs, or in responses
- [ ] All tests pass
