# ADR-0013: Regenerate is preview only; Save to Spotify writes

Status: Accepted (Nishchay, 2026-10-16)

## Context

The mockup's Generate/Regenerate button wrote to Spotify; writing while playing can make playback skip.

## Decision

Regenerate recomputes the Preview only. Writing to Spotify happens only on an explicit 'Save to Spotify' action.

## Consequences

No accidental writes; fewer API calls. The UI has two distinct actions.
