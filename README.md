# rulemix (Spotify Playlist Rules)

## Setup

```sh
nvm use                       # Node 20
corepack enable               # pnpm 9.12.0 via packageManager
pnpm i
docker compose up -d db       # Postgres 16 on 127.0.0.1:54322 (rulemix, rulemix_test)
cp .env.example .env.local    # fill in Spotify + secrets
pnpm dev                      # http://127.0.0.1:3000
```

## Checks

`pnpm typecheck && pnpm lint && pnpm test` (before every commit), `pnpm build`, `pnpm test:e2e`.

## Database (local Postgres 16)

Schema lives in `supabase/migrations/NNNN_name.sql`; apply with `pnpm db:migrate` (uses `DATABASE_URL`, or `--url <url>`).
Tests in `apps/web/lib/db` use `TEST_DATABASE_URL` and skip with a warning if it is unreachable.

**Machines with Docker:** `docker compose up -d db` (Postgres 16 on 127.0.0.1:54322, creates `rulemix` + `rulemix_test` via `docker/init.sql`).

**The shared dev box (no Docker):** Postgres 16 is installed from apt (PGDG repo) as the Debian cluster `16/main`,
reconfigured to `port = 54322`, `listen_addresses = '127.0.0.1'`, user `postgres` / password `postgres`,
with `docker/init.sql` applied, so the same `DATABASE_URL` / `TEST_DATABASE_URL` work unchanged.

```sh
sudo pg_ctlcluster 16 main start     # also: stop | restart | status   (pg_lsclusters to list)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres rulemix
pnpm db:migrate                      # with DATABASE_URL exported
```

The box has no systemd, so start the cluster after a reboot. Logs: `/var/log/postgresql/postgresql-16-main.log`.

## Android app (`apps/android`)

Native Kotlin + Jetpack Compose (ADR-0031), package `com.rulemix.app`, minSdk 26, targetSdk 33.
Modules: `:app` (UI, networking, App Remote) and `:engine` (pure-JVM Kotlin port of the rules
engine, tested against `packages/rules-engine/fixtures`).

On the box, JDK 17, the Android SDK 34 and Gradle live in `~/tools`:

```sh
cd apps/android
export JAVA_HOME=~/tools/jdk ANDROID_HOME=~/tools/android
echo "sdk.dir=$ANDROID_HOME" > local.properties
SPOTIFY_ENV_FILE=../web/.env.local ./gradlew :app:assembleDebug :app:testDebugUnitTest :engine:test
```

`SPOTIFY_CLIENT_ID` (or `SPOTIFY_ENV_FILE`) is read at build time; `RULEMIX_API_BASE_URL`
overrides the API host (default `https://rulemix.vercel.app`). CI: `.github/workflows/android.yml`.
