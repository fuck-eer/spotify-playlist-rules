# ADR-0026: Android plays the Mix through the Player playlist

Status: Accepted (Nishchay, 2026-10-17). Supersedes ADR-0025.

## Context

ADR-0025 chose the App Remote queue. Further research (docs/research/android-queue-vs-playlist.md) found:
- Songs the user added with "Add to queue" are not cleared when a new playlist starts. Spotify's own docs say they always play first. Our spike also showed `play()` keeps them. So a dummy "start" playlist wouldn't clear them.
- Our own queued Mix sits in the same "Add to queue" section, so every new Play would stack behind the unplayed rest of the previous one.
- The Player playlist (ADR-0021/0022) is already built, keeps exact order with repeats, and works on the phone via `context_uri`.

## Decision

- The Android app uses the same single private `rulemix player` playlist as web. Play goes through the same server Play run: overwrite via the Web API, create if missing, under the per-user lock.
- The app then starts it from the first track via App Remote: `setShuffle(false)`, then `play(spotify:playlist:<player id>)`. If App Remote isn't connected or fails, it opens the playlist in Spotify instead.
- The SDK queue approach (`play` + `queue()` per slot) and the dummy start-song/"ignored song" idea are dropped.
- App Remote stays for start-playback and PlayerState only. Auth still runs `AuthorizationClient` in the foreground first, with the targetSdk-33 workaround (ADR-0025 context).

## Consequences

- Web and Android share one mechanism, one playlist and the same edge cases.
- Songs the user queued by hand still play first; no option can prevent that. Handling (a hint, or "Skip to mix" while the app is open) is left to the mobile grill.
- Needs network for the write; the playlist itself persists and can be reopened or downloaded.
