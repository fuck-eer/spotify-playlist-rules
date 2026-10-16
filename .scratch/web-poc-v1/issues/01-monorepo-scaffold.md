# 01: Monorepo scaffold

**Status:** ready-for-agent
**Type:** task
**Blocked by:** None (can start immediately)
**Glossary terms:** none (infrastructure)
**Refs:** ADR-0001, ADR-0002, CODING_STANDARDS.md, docs/spec.md

## What to build
An empty, green monorepo. Running `pnpm i && pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes, and `pnpm dev` serves a Next.js page at http://127.0.0.1:3000 that renders a shadcn `Button` animated with Framer Motion on the mockup's dark background.

## Files to create
- `package.json` (root, private, `"packageManager": "pnpm@9.12.0"`). Scripts:
  - `build`: `turbo build`
  - `dev`: `turbo dev`
  - `typecheck`: `turbo typecheck`
  - `lint`: `turbo lint`
  - `test`: `turbo test`
  - `test:e2e`: `turbo test:e2e`
  - `format`: `prettier -w .`
  - `db:migrate`: `tsx scripts/migrate.ts` (the file itself is created in ticket 03; add the script now)

  devDeps: `turbo@^2`, `typescript@^5.6`, `prettier@^3`, `tsx@^4`, `vitest@^2`, `@types/node@^20`, `eslint@^9`, `typescript-eslint@^8`.
- `pnpm-workspace.yaml`: `packages: ["apps/*", "packages/*"]`
- `turbo.json`: tasks `build` (dependsOn `^build`, outputs `.next/**`, `!.next/cache/**`, `dist/**`), `dev` (persistent, no cache), `typecheck` (dependsOn `^build`), `lint`, `test` (dependsOn `^build`), `test:e2e` (no cache).
- `tsconfig.base.json` with the strict flags listed in CODING_STANDARDS.md, plus `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `skipLibCheck true`, `isolatedModules true`, `verbatimModuleSyntax true`.
- `.nvmrc` (`20`), `.prettierrc` (`{"printWidth":100}`), `.gitignore` (node_modules, .next, dist, .turbo, .env*.local, coverage, playwright-report, test-results, spikes/**/result.json, spikes/**/*.log)
- `.env.example` with every variable from CODING_STANDARDS.md (no real values)
- `eslint.config.js` (root flat config: typescript-eslint recommendedTypeChecked + `no-floating-promises`)
- `docker-compose.yml`: service `db`, image `postgres:16`, port `54322:5432`, env `POSTGRES_PASSWORD=postgres`. An init script `docker/init.sql` creates databases `rulemix` and `rulemix_test`.
- `packages/rules-engine/`: `package.json` (`@rulemix/rules-engine`, `type: module`, `exports: ./src/index.ts`, scripts `typecheck: tsc --noEmit`, `lint: eslint src`, `test: vitest run`, `build: tsc -p tsconfig.build.json`, devDep `fast-check@^3`), `tsconfig.json` extending the base, `vitest.config.ts`, `src/index.ts` exporting `export const ENGINE_VERSION = "0.0.0";`, `src/index.test.ts` asserting ENGINE_VERSION is a string.
- `packages/spotify/`: same shape (`@rulemix/spotify`), `src/index.ts` exporting `export const SPOTIFY_PACKAGE = "spotify";` plus one trivial test.
- `apps/web/`:
  - Next.js 15 App Router app (`@rulemix/web`) with React 19, `typescript`, and `src/` off (folders `app/`, `components/`, `lib/` at the app root).
  - Tailwind v4 via `@tailwindcss/postcss`. `app/globals.css` uses `@import "tailwindcss";` and an `@theme` block defining the mockup tokens:
    - `--color-bg:#121212`, `--color-s1:#181818`, `--color-s2:#242424`, `--color-s3:#2e2e2e`;
    - `--color-line:#333333`, `--color-tx:#ffffff`, `--color-mut:#b3b3b3`, `--color-dim:#7a7a7a`;
    - `--color-g:#1DB954`, `--color-err:#f15e6c`;
    - `--font-mono:ui-monospace,SFMono-Regular,Menlo,monospace`.
  - shadcn/ui initialised with `components.json` (style new-york, baseColor neutral, cssVariables true) and the `button` component added.
  - `motion@^11` installed.
  - `app/page.tsx` renders the "rulemix" wordmark and a shadcn Button wrapped in `motion.div` (fade-in, 200ms).
  - Scripts:
    - `dev`: `next dev -H 127.0.0.1 -p 3000`
    - `build`: `next build`
    - `typecheck`: `tsc --noEmit`
    - `lint`: `next lint`
    - `test`: `vitest run`
    - `test:e2e`: `playwright test`
  - devDeps: `@playwright/test@^1`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`.
  - `vitest.config.ts` (environment jsdom for `*.test.tsx`), `playwright.config.ts` (webServer `pnpm dev`, baseURL `http://127.0.0.1:3000`, chromium only), `e2e/home.spec.ts`.
  - Workspace deps: `@rulemix/rules-engine` and `@rulemix/spotify` (`workspace:*`), `transpilePackages` set for both in `next.config.ts`.
- `README.md`: setup steps (nvm use, pnpm i, docker compose up -d db, cp .env.example .env.local, pnpm dev).

## Tests (write first)
- `packages/rules-engine/src/index.test.ts`: `ENGINE_VERSION` is a string.
- `packages/spotify/src/index.test.ts`: `SPOTIFY_PACKAGE === "spotify"`.
- `apps/web/app/page.test.tsx`: rendering `<Page/>` shows the text "rulemix".
- `apps/web/e2e/home.spec.ts`: GET `/` has status 200 and the text "rulemix" is visible.

## Acceptance criteria
- [ ] `pnpm i` works with a committed `pnpm-lock.yaml`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all exit 0
- [ ] `pnpm test:e2e` passes locally
- [ ] Tailwind classes such as `bg-bg text-tx` resolve to the mockup colours
- [ ] No secrets committed; `.env.example` lists all variables
