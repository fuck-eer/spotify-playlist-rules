# ADR-0034: Android authentication against the rulemix backend

Status: **Proposed, needs Nishchay's approval.** Nothing in the Android tickets that depends on it may start before he approves.

## Context

Web auth is cookie-based: the server runs Spotify Authorization Code with PKCE, stores the encrypted refresh token, and sets a `rulemix_session` cookie (ADR-0009). The Android app must call the same API as the same user (ADR-0032), and App Remote needs the user's consent for `app-remote-control` (spike: explicit `AuthorizationClient` login first).

## Proposal

1. **One Spotify login in the app** with the Spotify auth library: `AuthorizationClient.openLoginActivity` with `Type.CODE`, redirect `rulemix://callback`, and the web scopes plus `app-remote-control`. It uses the installed Spotify app (no password typing), and the same consent covers App Remote, so App Remote then connects with `showAuthView(false)`.
2. **Server exchanges the code:** the app POSTs `{ code, redirectUri }` to `POST /api/mobile/session`. The server exchanges it using its client secret (confidential client; the secret never ships in the APK), fetches `/me`, upserts the user exactly like the web callback, and creates a session row with `kind = 'mobile'`.
3. **rulemix session token:** the response is `{ token, expiresAt, user: { id, displayName } }`. The token is a random 32-byte value; only its sha256 is stored (same `sessions` table, 30-day TTL). The app keeps it in Android Keystore-backed storage and sends `Authorization: Bearer <token>`.
4. **Every existing API route accepts the Bearer token** as well as the cookie (one change in the session lookup), so Android uses the same endpoints as web. `DELETE /api/mobile/session` signs out.
5. Spotify tokens stay server-side; the app never holds a Spotify refresh token.

## Alternatives

- App-side PKCE via Custom Tab to accounts.spotify.com, then the same exchange endpoint with a `codeVerifier`. No client secret needed, but a browser login, and App Remote may still need a separate consent.
- Reuse the web flow in a WebView and read the cookie: fragile, blocked by Spotify's login pages in WebViews; rejected.

## Needs from Nishchay

- Approve this proposal (or the PKCE alternative).
- In the Spotify dashboard: add redirect URI `rulemix://callback` and the release package `com.rulemix.app` + release SHA-1.
