# ADR-0023: Playback scopes, and existing users without them

Status: Accepted (Nishchay, 2026-10-17)

## Context

Remote play needs `user-read-playback-state` and `user-modify-playback-state`. Users who signed in before phase 1 have tokens without them; Spotify only grants new scopes on a fresh authorization.

## Decision

- The login requests the four playlist/library scopes plus the two playback scopes (supersedes A8's list of four).
- Whether a user can auto-play is decided from the stored `users.scopes`: both playback scopes must be present.
- Without them, Play still writes and opens the Player playlist, skips the remote-play step (outcome `needs_scopes`), and the Mix page shows the hint "Log in again to enable auto-play" with a link to sign in again.

## Consequences

No forced re-login. Existing users keep working and can opt into auto-play by signing in again.
