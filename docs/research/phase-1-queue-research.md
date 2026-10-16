# Phase 1 research: managing the queue instead of creating playlists

Date: 2026-10-16. Status: desk research. Items marked **(unverified)** come from community reports or have not been tested by us.

## Verdict (short)

- **"Clear the queue, then fill it in the rules' order, with duplicates" is not possible as stated.** The Web API has no clear, remove or reorder for the queue, and Spotify has said it has no near-term plans to add one.
- **What is possible:** *replace* what is playing by starting playback with an explicit `uris` list (`PUT /me/player/play`). That list can be our rule-ordered sequence, and it becomes the new "context", so it acts as a fresh queue without creating a playlist. Duplicates in the list are reported to work, with a caveat about offsets **(unverified)**. Anything the user queued by hand ("Next in queue") is not cleared by this **(unverified, widely reported)**.
- **Android:** yes, our app can control the Spotify app (play, pause, skip, queue) using the App Remote SDK, or the Web API. The SDK is still labelled Beta and is maintained only lightly.
- **Hard requirements:** every user needs **Spotify Premium** and an **active device**. In Development Mode we're capped at **5 authorised users** (Feb 2026 change). A public launch needs Extended Quota approval, which is hard to get.

## A) Web API queue

| Need | Available? | Notes |
|---|---|---|
| Add to queue | Yes: `POST /me/player/queue?uri=` | One track or episode per call. Premium only. Scope `user-modify-playback-state`. Targets the active device, or the one given by `device_id`. "Order of execution is not guaranteed" when mixed with other player calls. [1] |
| Read queue | Yes: `GET /me/player/queue` | Returns `currently_playing` plus `queue[]`. It shows only the next ~20 items **(unverified)** and does not separate hand-queued items from context items. Scope `user-read-playback-state`. [2] |
| Clear, remove or reorder | **No** | No public endpoint. Spotify staff on the forum: "no plans to add this in the near future". The clients use an internal `set_queue` that isn't public. [3] |
| Same track queued several times | Yes **(unverified, community)** | Each call adds one entry, and nothing in the docs forbids repeats. |
| Replace with an explicit list | Yes: `PUT /me/player/play` with `{"uris":[...]}` | Replaces the current context with our list. The docs give no max count. Community testing found a request-size limit of about 378 URIs with an offset **(unverified, old)**. [4][5] |
| Duplicates in `uris` | Mostly **(unverified)** | Plays, but `offset.position` pointing at an earlier copy of a repeated URI returns 403. Workaround: start at position 0 with a unique first track, or don't use an offset. [6] |
| Rate limits | Rolling 30-second window, not published; 429 with `Retry-After`. [7] | Dev mode limits are lower. Polling every few seconds per user is fine at our scale. |
| Shuffle and user changes | Risk | If shuffle is on, Spotify shuffles a `uris` context too, which breaks the rule order. We can turn it off with `PUT /me/player/shuffle?state=false` before playing. The user can skip, reorder or start other music at any time, and we can't stop that. |
| React to track changes | Polling only | Poll `GET /me/player/currently-playing` (or `/me/player`) every few seconds. The Web API has no push or webhook. The Android SDK *does* push player state (see B). |

Takeaway: the reliable primitive is **"play this exact list now"**, not "edit the queue". An "inject on the fly" design (watch for track changes, then add to queue) works but is fragile: hand-queued items, timing, and polling while the app is closed.

## B) Android

- **Spotify App Remote SDK** (Android SDK) [8][9][10]: connects to the installed Spotify app over IPC. `PlayerApi` has `play(uri)`, `queue(uri)` (tracks), `pause`, `resume`, `skipNext`, `skipPrevious`, `skipToIndex`, `setShuffle`, `setRepeat`, and a pushed `subscribeToPlayerState()`. `play()` takes **one URI** (a track, playlist or album), **not a list**, so you can't play an arbitrary list directly. Options: play the first track, then `queue()` the rest, or combine it with Web API `PUT /me/player/play` using `uris`.
  - Requires: the Spotify app installed and logged in, Premium for on-demand play (`Capabilities.canPlayOnDemand`), the app's package name and SHA-1 fingerprint registered in the developer dashboard, and the same dev-mode 5-user cap.
  - Status: still "Beta, likely to change significantly without warning". Releases are rare and a GitHub issue asks whether it's maintained [11]. It still works and is documented, but treat it as low-maintenance **(current 2026 release state unverified)**.
  - It also has a broadcast (`com.spotify.music.active`, etc.) for track changes if enabled in Spotify's settings [8].
- **Web API from Android** (Spotify Connect): the same endpoints as in A, working on any device including the phone. No SDK dependency, but it needs network and an active device.
- **MediaSession / MediaController** (`NotificationListenerService`): can play, pause and skip any media app, Spotify included. It can't queue specific Spotify tracks or play a URI list. Fine as a fallback for transport controls only.

## C) Recommended architecture for phase 1

1. **Keep the rules engine as is.** It already outputs an ordered slot list with duplicates.
2. **"Play mix" = one call:** turn shuffle off, then `PUT /me/player/play` with `uris` = the engine output (cap it around 300, or play in chunks). The user gets the rule order immediately with no new playlist. Show "Shuffle off" and the device we're playing on.
3. **No active device:** show a picker (`GET /me/player/devices`) and pass `device_id`. If none, tell the user to open Spotify first.
4. **Long mixes (over 300):** a "top-up" loop. Poll currently-playing (web) or subscribe to player state (Android). When there are about 3 tracks left, either replay the next chunk with `uris`, or `POST /me/player/queue` the next few.
5. **Android app:** App Remote SDK for player state and transport, plus the Web API for `uris` playback (our server keeps the tokens). Fall back to the Web API only if the SDK breaks.
6. **Keep "save as playlist" as an optional export** for users who want something lasting, offline or shareable.

**Risks:** Premium-only; the 5-user dev cap plus a tough Extended Quota review; a hand-queued "Next in queue" can still play before our list; the user can toggle shuffle mid-session; the `uris` size limit and duplicate-offset quirk are undocumented; the "no altering content" and "non-commercial streaming" policy notes on the player endpoints [1].

**Alternatives:** (a) keep playlists but reuse **one** hidden target playlist per user, overwritten each time, so there's no playlist clutter (this is the most robust way to get exact order and duplicates); (b) a hybrid: play a `uris` list for the session, with an optional save.

## Live check

Not run. It would need decrypting the stored refresh token outside the app, and the read-only `GET /me/player/queue` adds little beyond the docs. Recommended manual test (it changes playback, so do it with Nishchay's OK): `PUT /me/player/play` with `uris` [A, B, A, A], check it plays A, B, A, A, and check that `GET /me/player/queue` shows the duplicates.

## Sources

1. Add Item to Playback Queue: https://developer.spotify.com/documentation/web-api/reference/add-to-queue
2. Get the User's Queue: https://developer.spotify.com/documentation/web-api/reference/get-queue
3. Forum, "Clear Queue API": https://community.spotify.com/t5/Spotify-for-Developers/Clear-Queue-API/td-p/6209489
4. Start/Resume Playback: https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
5. GitHub spotify/web-api #462 (queue, uris size): https://github.com/spotify/web-api/issues/462 ; #578: https://github.com/spotify/web-api/issues/578
6. Forum, offset with duplicate URIs: https://community.spotify.com/t5/Spotify-for-Developers/Playing-with-an-offset-is-not-working-when-element-in-URI-list/td-p/4992487
7. Rate limits: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
8. Android SDK overview: https://developer.spotify.com/documentation/android
9. PlayerApi reference: https://spotify.github.io/android-sdk/app-remote-lib/docs/com/spotify/android/appremote/api/PlayerApi.html
10. App Remote changelog: https://github.com/spotify/android-sdk/blob/master/app-remote-lib/CHANGELOG.md
11. "Is this SDK still maintained?": https://github.com/spotify/android-sdk/issues/340
12. Feb 2026 developer access update (Premium, 5 users, 1 client ID): https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
13. Feb 2026 changelog: https://developer.spotify.com/documentation/web-api/references/changes/february-2026 ; migration guide: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
