# 03: Server: mobile session endpoint and Bearer auth

**What to build:** the Android app can exchange a Spotify authorization code for a rulemix session token, and every API route accepts `Authorization: Bearer <token>` as well as the cookie.

**Blocked by:** **Nishchay's approval of ADR-0034** (proposed). v2-web/02 (migration 0006 adds `sessions.kind`).

**Status:** blocked (approval)

**Glossary:** none new. **ADRs:** 0009, 0032, 0034.

**Files**
- `packages/spotify/src/oauth.ts`: `exchangeCode(cfg, p: { code: string; verifier?: string; redirectUri?: string })`: omit `code_verifier` when absent; `redirect_uri` = `p.redirectUri ?? cfg.redirectUri`; client secret Basic auth as today.
- `apps/web/lib/auth/upsert-user.ts`: `upsertSpotifyUser(sql, tokens, me)` extracted from the web callback (callback uses it).
- `apps/web/lib/auth/session.ts`: `createSession(sql, userId, kind: "web" | "mobile" = "web")`; `userFromRequest` reads `Authorization: Bearer` first, then the cookie (request type widened to include `headers.get`).
- `apps/web/app/api/mobile/session/route.ts`: `POST { code: string, redirectUri: "rulemix://callback" }` → 200 `{ token, expiresAt, user: { id, displayName } }`; 400 invalid body or other redirect; 401 when Spotify rejects. `DELETE` destroys the Bearer session → 204.
- Env: `MOBILE_REDIRECT_URI=rulemix://callback` in `lib/env.ts` and `.env.example`.

**Acceptance criteria**
- [ ] Route tests with fake Spotify: success creates a `mobile` session and upserts the user; Spotify error → 401; wrong redirect → 400; DELETE then any route with the token → 401.
- [ ] `lib/mixes-routes.test.ts` gains a case: `GET /api/mixes` with a Bearer token returns that user's Mixes; cookie path unchanged.
- [ ] Token never logged; only sha256 stored.
