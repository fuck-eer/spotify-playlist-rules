# 18: Lint and format gate

**Status:** done
**Type:** task
**Refs:** review S4, N1, N2, N3

## Decision
- `.prettierignore`: `apps/web/components/ui/` and `spikes/` (vendor/spike code), plus build outputs.
- Root script `format:check` = `prettier --check .`; root `lint` runs it after `turbo lint`.
- Run `pnpm format` once, in its own commit.
- `apps/web` lint uses the ESLint CLI (`eslint .`) with a flat config that includes `@next/eslint-plugin-next` (core-web-vitals) and `eslint-plugin-react-hooks`; confirm their rules fire.
- N2: remove or justify the `react-hooks/exhaustive-deps` disable comments.
- N3: `isUuid()` in `lib/validation.ts`, used by every repo.

## Tests (write first)
- `validation.test.ts`: `isUuid` accepts a v4 uuid (any case) and rejects other strings.
- Lint rule check: a throwaway file using `<img>` and a conditional hook makes `eslint` report `@next/next/no-img-element` and `react-hooks/rules-of-hooks` (verified manually, file not committed).

## Acceptance criteria
- [x] `pnpm lint` (incl. format:check) passes with no "Next.js plugin was not detected" warning
- [x] All tests pass

## Notes (implementation)
- Two commits: config + `isUuid` (lint without the format check), then `pnpm format` together with wiring `prettier --check .` into root `lint`, so every commit passes its own gate.
- `.prettierignore` keeps the existing `docs` and `.scratch` entries.
- `eslint-config-next` and `@eslint/eslintrc` removed; `@next/eslint-plugin-next@15.5.28` and `eslint-plugin-react-hooks@5.2.0` added to apps/web. Probe file (not committed) confirmed `react-hooks/rules-of-hooks` (error) and `@next/next/no-img-element` (warning) fire.
- N2: the unused disable was removed; the two remaining `exhaustive-deps` disables now carry `--` reasons.
- CODING_STANDARDS "Before every commit" notes that lint includes the format check.
