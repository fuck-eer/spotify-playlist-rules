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
