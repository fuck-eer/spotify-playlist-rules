# Coding standards

## Stack (ADR-0001, ADR-0002)

- **Monorepo:** pnpm 9 workspaces + Turborepo 2. Node 20 LTS (`.nvmrc` = `20`). Packages are scoped `@rulemix/*`.
- **Language:** TypeScript 5.x, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`. No `any`; use `unknown` and narrow it. No `@ts-ignore`. `@ts-expect-error` is allowed only with a reason comment.
- **ES modules everywhere:** `"type": "module"`.
- **Web:** Next.js 15 App Router (`apps/web`), React 19, Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`), shadcn/ui (components copied into `apps/web/components/ui`), Framer Motion (`motion` package import `motion/react`).
- **Tests:**
  - vitest (unit and integration);
  - fast-check (property-based tests in `packages/rules-engine`);
  - Playwright (end-to-end, `apps/web/e2e`).
- **Database:** Supabase Postgres, reached via the `postgres` npm driver with `DATABASE_URL`, server-only. Plain SQL migrations in `supabase/migrations/NNNN_name.sql`. Local and test databases: Postgres 16 on 127.0.0.1:54322 with `rulemix` and `rulemix_test`, via `docker compose up -d db` or the native cluster (`sudo pg_ctlcluster 16 main start`); see README. Don't create hosted projects or anything paid without asking Nishchay (ADR-0008).

## Commands (root)

- `pnpm build` · `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e` · `pnpm db:migrate` · `pnpm format`
- **Before every commit:** `pnpm typecheck && pnpm lint && pnpm test` must pass. `pnpm lint` runs ESLint (CLI, flat config) and `prettier --check .` (also available as `pnpm format:check`).
- **Practice TDD:** write a failing test first.

## Naming

- **Files:**
  - `kebab-case.ts`;
  - React components in `kebab-case.tsx` exporting `PascalCase`;
  - tests next to the code they test as `*.test.ts(x)`;
  - end-to-end tests as `e2e/*.spec.ts`.
- **Identifiers:**
  - types and interfaces in `PascalCase` (no `I` prefix);
  - functions and variables in `camelCase`;
  - constants in `UPPER_SNAKE_CASE`;
  - database tables and columns in `snake_case`.

  Map between camelCase and snake_case only in the data layer (`apps/web/lib/db`).

- **Domain terms:** use exactly the terms in `GLOSSARY.md`: Rule, Mix, Rule Set, Base list, Source playlist, Target playlist, Preview, Seed, Archive, Save to Spotify, Regenerate. In code, a Rule bound to a song inside a Mix is a `MixRule`.
- **Rule kinds:** the strings `"pin_first" | "every_n" | "repeat"`.

## Error handling

- Pure packages (`rules-engine`) never throw for domain problems. They return issues or results; they throw only on programmer errors (invalid arguments), with `RangeError` or `TypeError`.
- `packages/spotify` throws typed errors only:
  - `SpotifyAuthError` (401 after refresh, or `invalid_grant`);
  - `SpotifyForbiddenError` (403);
  - `SpotifyNotFoundError` (404);
  - `SpotifyRateLimitError` (429 retries exhausted);
  - `SpotifyHttpError` (any other status).

  All of these extend `SpotifyError`, which has `status: number` and `body: unknown`.

- Route handlers catch errors and return JSON `{ error: { code: string, message: string } }` with a correct HTTP status. The `message` is user-facing copy and must never contain tokens or stack traces.
- Never swallow errors silently. Log server-side with `console.error` and context (`userId`, `mixId`), never with tokens.

## Security

- No secrets in code, tests, fixtures, logs or commits. Read secrets only from `process.env`, through `apps/web/lib/env.ts` (validated with zod at first use).
- Spotify tokens never reach the browser. The refresh token is encrypted with AES-256-GCM (ADR-0009). The session cookie is `httpOnly`, `Secure` (in production), and `SameSite=Lax`.
- Every database query is scoped by `user_id`.

## Environment variables (`.env.example` committed; `.env.local` gitignored)

| Name                        | Example / default                                           | Purpose                          |
| --------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `SPOTIFY_CLIENT_ID`         | (none)                                                      | Spotify app id                   |
| `SPOTIFY_CLIENT_SECRET`     | (none)                                                      | Spotify app secret (server only) |
| `SPOTIFY_REDIRECT_URI`      | `http://127.0.0.1:3000/api/auth/callback`                   | OAuth callback                   |
| `SPOTIFY_ACCOUNTS_BASE_URL` | `https://accounts.spotify.com`                              | overridable for tests            |
| `SPOTIFY_API_BASE_URL`      | `https://api.spotify.com/v1`                                | overridable for tests            |
| `APP_URL`                   | `http://127.0.0.1:3000`                                     | absolute app URL                 |
| `DATABASE_URL`              | `postgres://postgres:postgres@127.0.0.1:54322/rulemix`      | Postgres                         |
| `TEST_DATABASE_URL`         | `postgres://postgres:postgres@127.0.0.1:54322/rulemix_test` | integration tests                |
| `TOKEN_ENCRYPTION_KEY`      | 32 random bytes, base64                                     | AES-256-GCM key                  |
| `SESSION_SECRET`            | ≥32 random chars                                            | HMAC for the OAuth state cookie  |
| `MAX_RULES_PER_MIX`         | `10`                                                        | ADR-0017                         |
| `MAX_SOURCE_TRACKS`         | `600`                                                       | ADR-0017                         |

## Style

- Prettier (default settings, `printWidth: 100`). ESLint flat config with `typescript-eslint` recommended-type-checked and `next/core-web-vitals` in `apps/web`.
- Prefer small deep modules with narrow exported interfaces. Export public types from each package's `src/index.ts` only.
- Use `async`/`await` with no floating promises (enforced by the `@typescript-eslint/no-floating-promises` rule).
- UI follows the mockup in `docs/design/DSN-20261016-playlist-rules/` (v3 = current `index.html`). Motion lasts about 200ms and respects `prefers-reduced-motion`.
