# 18: Lint and format gate

**Status:** ready-for-agent
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
- [ ] `pnpm lint` (incl. format:check) passes with no "Next.js plugin was not detected" warning
- [ ] All tests pass
