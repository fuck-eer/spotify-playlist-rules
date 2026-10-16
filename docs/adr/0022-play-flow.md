# ADR-0022: Play writes the Player playlist, then starts it with context_uri when a device is active

Status: Accepted (Nishchay, 2026-10-17)

## Context

The live test (2026-10-16) showed `context_uri` playback on the phone works, `uris`-list playback does not, and a 204 from `play` doesn't prove anything is playing.

## Decision

Play on a Mix:
1. Reads the Source and builds the order exactly as Save does (duplicates kept, Unavailable tracks skipped, ADR-0011).
2. Writes it into the Player playlist (ADR-0021), creating it if missing.
3. If the user has the playback scopes (ADR-0023): looks up devices; if one is active, turns shuffle off on it and starts `spotify:playlist:<player id>` via `context_uri` on that device, then checks `currently-playing`. If nothing is playing, the outcome is "not started"; this is not an error. A failure in this remote-play step (any Spotify error) is logged and also counts as "not started": the playlist is already written.
4. Finally the Mix page shows a dialog with the outcome and an "Open in Spotify" link to `https://open.spotify.com/playlist/<player id>` that the user taps (on phones this opens the Spotify app). The page never navigates by itself: a navigation after the background run has no user gesture, so Android may load the web page instead of handing off to the app (Nishchay, 2026-10-17).

Playback outcomes: `started`, `not_started`, `no_device`, `needs_scopes`.

## Consequences

Play never uses `uris`-list playback or the queue. The check after `play` waits briefly (about 1.5 s) before reading `currently-playing`. Remote play is best effort; the dialog's link is the reliable path.
