# ADR-0009: Server-side Spotify auth

Status: Accepted (Nishchay, 2026-10-16)

## Context

Research recommended browser-only PKCE with the token in browser storage.

## Decision

Auth runs server-side in Next.js route handlers using authorization code + PKCE. The refresh token is stored encrypted in Supabase; the browser holds only an httpOnly session cookie.

## Consequences

Tokens never reach client JS. Needs an encryption key in server env. Refresh-token 6-month expiry handling still applies.
