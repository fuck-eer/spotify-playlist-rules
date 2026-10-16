# ADR-0010: Spotify keeps duplicate URIs (spike result)

Status: Accepted (Nishchay, 2026-10-16)

## Context

Research §9 flagged that duplicate URIs in API-written playlists were undocumented; Repeat (ADR-0003) depends on them. The spike in spikes/duplicates/ wrote A,A,B via PUT then A via POST.

## Decision

Confirmed: Spotify keeps duplicate URIs in order (read back A,A,_,A). Track B came back null (likely a bad/unavailable id), which is handled by ADR-0011. The engine may emit duplicates freely.

## Consequences

Repeat N and Insert every N work as designed. Unavailable tracks can appear as null items when reading playlists.
