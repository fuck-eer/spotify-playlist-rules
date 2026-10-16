# ADR-0003: Repeat N plays back to back

Status: Accepted (Nishchay, 2026-10-16)

## Context

Research §4.3 recommended evenly spaced repeats; the 16 Oct requirement update and design say back to back.

## Decision

Repeat N times places the N copies of the song consecutively.

## Consequences

Overrides the research recommendation. Depends on Spotify keeping duplicate URIs (verified by the duplicates spike). Keep N moderate (Spotify policy II.2).
