# ADR-0017: Configurable limits, paged I/O with progress

Status: Accepted (Nishchay, 2026-10-16)

## Context

The design capped a Mix at 5 rules; large sources cost API quota.

## Decision

Limits are env-configurable: MAX_RULES_PER_MIX=10, MAX_SOURCE_TRACKS=600 (larger sources are refused with a clear message). Reads and writes are paged in 100s with progress shown. Overrides the design's 5-rule cap. Rule colour palette extended to 10 colours in the design's style; colour is assigned by position in the Rule Set.

## Consequences

Design needs 5 more colours. Note: Spotify playlist-items reads max 50 per page (research §3.2), so 'pages of 100' applies to writes; reads progress in Spotify's maximum page size.
