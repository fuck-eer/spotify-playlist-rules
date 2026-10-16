# ADR-0001: Monorepo with pnpm workspaces + Turborepo

Status: Accepted (Nishchay, 2026-10-16)

## Context

The product needs a web app now, an Android app later, and a rule engine shared by both, plus a Spotify integration layer kept separate from rule logic (research §2, §6).

## Decision

pnpm workspaces + Turborepo. apps/web (Next.js), packages/rules-engine (pure TypeScript, vitest + fast-check), packages/spotify (auth, paged reads, 100-item PUT then POST chunks, 429 backoff), apps/android (Kotlin, later).

## Consequences

The engine has no network/storage/clock dependencies and is tested in isolation. Spotify endpoint knowledge lives only in packages/spotify. One toolchain for TS packages; Android is built separately.
