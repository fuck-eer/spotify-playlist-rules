# ADR-0025: Android playback uses the App Remote queue

Status: Accepted (Nishchay, 2026-10-17). Pre-existing queue items are an **open problem**.

## Context

The Web API cannot play a `uris` list on the phone (phase-1 research, 204 then silent), so the web app uses the Player playlist (ADR-0021). The Android spike (`spikes/android-queue`, App Remote 0.8.0 on a OnePlus 12) showed:

- `play(A)` then `queue(B)`, `queue(B)`, `queue(C)`, `queue(A)` plays **A, B, B, C, A** exactly, repeats included.
- `play()` does **not** clear the user's queue: after queuing C,C and then `play(D)`, the next track was C.
- App Remote has **no clear-queue or read-queue** method ([PlayerApi](https://spotify.github.io/android-sdk/app-remote-lib/docs/com/spotify/android/appremote/api/PlayerApi.html)).
- `subscribeToPlayerState` pushes track changes reliably.
- On Android 14 the connection needs explicit foreground auth (AuthorizationClient) and a targetSdk-33 workaround (spotify/android-sdk#361, #377).

## Decision

The Android app plays a Mix through App Remote: `setShuffle(false)`, `play(first track)`, then `queue()` the rest in order. It does not write a playlist. Auth runs `AuthorizationClient` in the foreground first, then connects with `showAuthView(false)`.

## Open problem: items already in the user's queue

Anything the user queued before tapping Play is played **before** the rest of our Mix (after the first track). Options, none chosen yet:

1. **Skip until ours:** after queuing, follow PlayerState. When the current track isn't the next expected Mix track, `skipNext()` until it is. Matching is by URI plus order, and repeats are tracked by position resets. Downsides: brief audible blips, a mismatch if the user skips by hand, and it only works while connected.
2. **Fallback to the Player playlist:** write the order to the Player playlist (ADR-0021) and `play(playlist uri)`. Its context is exact, but pre-existing queue items still play first, and this needs a Web API token and a playlist.
3. **Warn and let the user decide:** before Play, say "Your Spotify queue may have songs in it; they'll play first", with an option to continue or open Spotify to clear it.
4. **Web API read-queue check:** use `GET /me/player/queue` (scope user-read-playback-state) to detect pre-existing items and only then use 1 or 3.

Option 1 combined with 4 is the current favourite, pending a spike.

## Consequences

- Exact order with repeats and no playlist clutter on Android. Web keeps the Player playlist.
- The app disconnects in `onStop` (Spotify's lifecycle guidance), so any skip-until-ours or progress logic only runs while the app is in the foreground unless we add a service.
- App Remote is beta and its last release was in 2023; keep the Player-playlist path as the fallback.
- Needs Spotify app + Premium on the device.
