# ADR-0011: Unavailable/null tracks are skipped

Status: Accepted (Nishchay, 2026-10-16)

## Context

The spike returned a null item for a track. Sources can contain unavailable, null or local items.

## Decision

Unavailable/null tracks are skipped from the written playlist. The Preview shows 'N songs skipped (unavailable)'. A Rule whose song is unavailable shows a warning.

## Consequences

The engine filters non-playable items before building the Base list and reports the skipped count and unavailable rule songs.
