# ADR-0004: Base order: seeded shuffle by default, keep-source-order option

Status: Accepted (Nishchay, 2026-10-16)

## Context

Plan open question: keep source order or reshuffle non-rule songs for variety.

## Decision

Both modes. Default is a seeded shuffle with the seed stored per Mix; a Reshuffle button changes the seed. Option to keep source order.

## Consequences

Same rules + same seed give the same result (deterministic engine). The seed is part of persisted Mix state.
