# ADR-0002: Next.js web proof of concept first, native Android later

Status: Accepted (Nishchay, 2026-10-16)

## Context

Research recommended a web SPA for v1 and Android later. Nishchay wants a shareable URL first.

## Decision

The Next.js web app is the proof of concept, shipped first via URL. A native Kotlin Android app follows. Web UI: Tailwind v4, shadcn/ui, Framer Motion. Rule-engine test fixtures are shared as JSON so the Kotlin port must produce identical output.

## Consequences

Next.js instead of Vite SPA (supersedes research §6 SPA choice). The engine is ported, not shared, on Android; JSON fixtures are the contract between implementations.
