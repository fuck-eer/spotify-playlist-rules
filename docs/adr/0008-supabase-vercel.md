# ADR-0008: Supabase Postgres storage, Vercel hosting

Status: Accepted (Nishchay, 2026-10-16)

## Context

Research suggested SQLite / browser storage; a hosted web app needs a server-side store.

## Decision

Storage is Supabase Postgres, keyed by Spotify user id. Hosting is Vercel. Stay on free tiers; ask Nishchay before any spending.

## Consequences

Data model is per Spotify user. No paid features without explicit approval.
