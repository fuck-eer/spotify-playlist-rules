# ADR-0016: Recreate a deleted Target playlist on Save

Status: Accepted (Nishchay, 2026-10-16)

## Context

The user may delete/unfollow the Target playlist in Spotify.

## Decision

If the Target was deleted, the next Save recreates it, stores the new ID, and shows a 'recreated' note.

## Consequences

Save must detect a missing/unfollowed target (e.g. 404/403 or not followed) before writing.
