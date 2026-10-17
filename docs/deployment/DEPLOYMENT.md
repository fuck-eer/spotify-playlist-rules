# Deployment — rulemix v2 (web + Android APK)

## Hosting
| Piece | Where | Identifier |
|---|---|---|
| Code | GitHub (public) | https://github.com/fuck-eer/spotify-playlist-rules — default + production branch `integration` |
| Web app (`apps/web`, Next.js 15) | Vercel, Hobby (free) | team `fuckeers-projects`, project `rulemix`, functions region `bom1` |
| Database (Postgres) | Supabase, free tier | project `rulemix`, ref `zfjkybsdbhguanzlwqkh`, region `ap-south-1` |

Production URL: **https://rulemix.vercel.app** (default `*.vercel.app` domain; no custom domain).

## Vercel project settings
- Root directory: `apps/web` (monorepo; Vercel installs from the workspace root via pnpm, `packageManager: pnpm@9.12.0`)
- Framework: Next.js (auto build `next build`)
- Install command: `pnpm install`
- Git: connected to the GitHub repo; pushes to `integration` deploy to production, other branches/PRs get preview deployments.

## Environment variables (production) — names only
Values live only in Vercel (Project → Settings → Environment Variables). Never commit them.

| Name | Notes |
|---|---|
| `DATABASE_URL` | Supabase **session pooler** URL (`aws-0-ap-south-1.pooler.supabase.com:5432`, user `postgres.<ref>`). Session mode is used because postgres.js uses prepared statements (transaction pooler on 6543 doesn't support them without `prepare: false`). Direct host `db.<ref>.supabase.co` is IPv6-only — don't use it from Vercel. |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | From the Spotify developer dashboard app. |
| `SPOTIFY_REDIRECT_URI` | `https://rulemix.vercel.app/api/auth/callback` — must exactly match a Redirect URI in the Spotify app. |
| `MOBILE_REDIRECT_URI` | `rulemix://callback` (v2, ADR-0034). `POST /api/mobile/session` rejects any other `redirectUri`. Must also be a Redirect URI in the Spotify app. |
| `APP_URL` | `https://rulemix.vercel.app` |
| `SPOTIFY_ACCOUNTS_BASE_URL`, `SPOTIFY_API_BASE_URL` | Real Spotify endpoints (overridable for tests). |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes base64 (`openssl rand -base64 32`). Prod-only; rotating it invalidates stored refresh tokens (users must log in again). |
| `SESSION_SECRET` | ≥32 random chars. |
| `MAX_RULES_PER_MIX` | `10` |
| `MAX_SOURCE_TRACKS` | `600` |

Env changes only apply to new deployments — redeploy after editing.

## Build / local commands
- `pnpm install` · `pnpm build` (turbo) · `pnpm --filter @rulemix/web dev`
- Tests: `pnpm test`, `pnpm test:e2e`

## Redeploy
- Normal: push to `integration` → automatic production deploy.
- Manual: Vercel dashboard → Deployments → latest → Redeploy (or `vercel --prod` from a linked checkout).

## Database migrations
SQL files in `supabase/migrations`, applied in order to project `zfjkybsdbhguanzlwqkh`:
- `0001`–`0004`: 2026-10-16 (v1)
- `0005_player_playlist`: 2026-10-17
- `0006_arrangement` (v2 arrangement, bench, album art, `sessions.kind` for mobile sessions; additive only): 2026-10-17, applied before the v2 code was pushed

Check what's applied with Supabase `list_migrations` (or `select * from supabase_migrations.schema_migrations`).
New migration: add `000N_name.sql`, then apply it (Supabase dashboard SQL editor, Supabase MCP `apply_migration`, or `pnpm db:migrate` with `DATABASE_URL` set) **before** deploying code that depends on it. Migrations are forward-only; write a new migration to undo.

RLS is enabled on every table with no policies, by design: only the server (via `DATABASE_URL`) touches data; the Supabase anon/public keys can read nothing. The app does not use the Supabase JS client or its keys.

## Android APK (v2)
- The signed release APK is committed at `apps/web/public/android/rulemix.apk` and served statically at `https://rulemix.vercel.app/android/rulemix.apk`. The signed-out page and the account menu link to it ("Get the Android app").
- Build/sign: see `docs/deployment/android-release.md` (`scripts/android-release.sh`). The keystore and its passwords live outside the repo. The APK contains only public values: API base URL `https://rulemix.vercel.app`, `rulemix://callback`, and the Spotify client id. It does not contain the client secret.
- To ship a new APK: rebuild, commit the new `rulemix.apk`, then push to `integration`. Each version adds ~12 MB to git history. Moving it to a GitHub Release or Vercel Blob is a known follow-up.
- Android sign-in: the app gets a Spotify code for `rulemix://callback`, then POSTs `{code, redirectUri}` to `/api/mobile/session`. The server exchanges the code with the client secret and returns a Bearer token (a `sessions` row with `kind='mobile'`).

## Rollback
- App: Vercel → Deployments → pick previous good production deployment → "Promote to Production" (instant rollback). Then revert the bad commit on `integration`.
- DB: no automatic down-migrations. Free tier has daily backups only via dashboard (no PITR).

## Gotchas
- **Spotify redirect URI**: add `https://rulemix.vercel.app/api/auth/callback` in the Spotify developer dashboard (app → Settings → Redirect URIs). Login fails with `INVALID_CLIENT: Invalid redirect URI` until then.
- **Spotify dashboard for Android**: also add Redirect URI `rulemix://callback` and the Android package `com.rulemix.app` with the release signing SHA-1, or app sign-in fails.
- **Spotify development mode**: only users added under the app's "User Management" allowlist (max 25) can log in; others get a 403 from the Web API. Extended quota requires a Spotify review.
- **Supabase free tier pauses** projects after ~1 week of inactivity, and the account is limited to 2 active free projects (`copycat` was paused to make room).
- **Vercel deployment protection**: Vercel Authentication covers preview/deployment-specific URLs; the production domain `rulemix.vercel.app` is public.
- Preview deployments have no env vars set (production only), so previews won't work until preview env vars are added.
