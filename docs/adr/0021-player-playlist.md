# ADR-0021: One Player playlist per user

Status: Accepted (Nishchay, 2026-10-17)

## Context

Phase 1 research (docs/research/phase-1-queue-research.md) found the Web API can't clear or reorder the queue, and on Nishchay's phone `PUT /me/player/play` with a `uris` list returns 204 but plays nothing. Starting a playlist via `context_uri` works. Creating one Target playlist per Mix piles playlists up in the user's library.

## Decision

- Each user has exactly one private Spotify playlist named `rulemix player`, description `Managed by rulemix. Play with shuffle off.` Spotify has no hidden playlists; private is the closest.
- Its id is stored per user (`users.player_playlist_id`). If it's null, or the playlist is no longer in the user's library (same check as ADR-0016), Play creates a new one and stores the id. Otherwise Play overwrites its items.
- Every Mix writes into the same Player playlist; the last Play wins.
- Save to Spotify and the per-Mix Target playlist (ADR-0015) stay as an optional secondary action.

## Consequences

Users end up with one rulemix playlist instead of one per Mix. Renaming the Player playlist in Spotify is safe (tracked by id). Deleting it just means the next Play recreates it.
