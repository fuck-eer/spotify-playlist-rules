# Android playback: SDK queue vs the phase-1 Player playlist

Date: 2026-10-17. Status: desk comparison + one pending on-device test (spike v0.4, Test 4). Inputs: `phase-1-queue-research.md`, ADR-0021..0025, spike results (v0.2/v0.3).

## The two options

1. **SDK queue (ADR-0025 as written), plus the "dummy start" idea.** Each user gets a private one-song `rulemix start` playlist. Play = App Remote `play(start playlist)` (shuffle off, repeat off), then `queue()` every mix slot in order. The start song is a known marker; the UI shows it as a grey "start" node and the app skips it (an "ignored" song).
2. **Reuse the phase-1 Player playlist on Android.** Server overwrites the user's private `rulemix player` playlist via the Web API (exactly as web, ADR-0021/0022), then the app calls App Remote `play(spotify:playlist:<player id>)` with shuffle off (or opens it in Spotify).

## What we know about Spotify's behaviour

| Fact | Evidence |
|---|---|
| The queue has two parts: **Next in queue** (things added with "Add to queue") and **Next from** (the rest of the playlist/album you started). Next in queue always plays first. | Spotify Community FAQ "How does the Play Queue work" [1]; Community "Return to playlist after song" [2] |
| Starting a new playlist/album/track **replaces Next from**, but **does not remove Next in queue**. A Spotify moderator test: played a playlist, queued a song, started an empty playlist, "the Play Queue was clear except for the song I added". | Community idea "Clear play queue" [3]; FAQ [1]; Support "Play Queue" [4] (Clear only clears added tracks) |
| No public API clears or removes queue items; App Remote 0.8.0 has `queue()` but no `clearQueue`/`getQueue`. | phase-1 research [5][6]; PlayerApi reference [7] |
| Our spike: `queue(C)`,`queue(C)`, then `play(D)` → next track was C. So `play(track)` kept the added queue. | spike v0.2 Test 2 (README) |
| App Remote `queue(uri)` adds to **Next in queue** (it is the "Add to queue" action). | inferred from Test 2 (queued C survived `play`) and [7]; not separately documented |
| `play(A)` + `queue(B,B,C,A)` plays A,B,B,C,A including back-to-back repeat. | spike v0.3 Test 1 (by ear) |
| Web API `context_uri` playback of a playlist on the phone works; `uris`-list playback returns 204 and plays nothing. | phase-1 live tests |

Nishchay's recollection ("starting a 3-song playlist replaces my 100-song queue") matches the **Next from** half: a playlist's own remaining tracks are replaced. The sources above say hand-added songs survive. **Spike v0.4 Test 4** checks this directly with App Remote (pre-queue P1,P2 → play a playlist → queue A,B,C → log what plays). Until it runs, treat "playlist switch clears the manual queue" as **unlikely but unconfirmed**.

## Comparison

| | (1) SDK queue + dummy start | (2) Player playlist on Android |
|---|---|---|
| **Effort** | New: start-playlist lifecycle (create/recreate, like ADR-0016), queue-feeding loop (one IPC call per slot; mixes up to MAX_SOURCE_TRACKS), skip logic for start song and any foreign tracks, "ignored song" concept in engine + UI, restart/resume handling. Medium–high. | Reuse the existing Play endpoint/run (ADR-0022/0024) from the app, then one `play(context)` call. Low. |
| **Pre-existing user queue** | Not cleared (per [1][3] and Test 2). Start marker lets us *detect* and skip foreign tracks, but only while our app is connected (foreground; App Remote disconnects in `onStop`). | Same limitation: hand-queued songs still play first [1]. Mitigation is identical (warn, or skip-until-ours while connected). Neither option fixes it. |
| **Leftovers from our own previous Play** | **Serious.** Our mix is itself in Next in queue, so re-Play (after editing a mix, or switching mix) leaves the unplayed rest of the old mix ahead of the new one. Every Play stacks. | None. Overwriting the playlist and re-starting it replaces Next from cleanly. |
| **Repeats / back-to-back duplicates** | Works (Test 1). | Works: playlist items keep duplicates (phase-1 spike, ADR-0010); order fixed with shuffle off. |
| **Shuffle** | Next in queue is not shuffled; robust. | Must turn shuffle off (we already do, ADR-0018/0022); user can re-enable it. |
| **Rate limits** | No Web API calls for playback (IPC only). | A few Web API writes per Play (replace + add in chunks of 100), same as web today; fine at our scale [8]. |
| **Offline** | Queue can only hold tracks Spotify can play; IPC works offline for downloaded tracks only. Untested. | Playlist write needs network; once written it can be downloaded for offline like any playlist. |
| **Account clutter** | One `rulemix start` playlist per user (plus Save targets). | One `rulemix player` playlist per user (already exists for web users). |
| **Latency** | `play` + N sequential `queue` calls (~400 ms spacing in the spike) — 100 slots ≈ tens of seconds before the whole mix is queued, though the first song starts immediately. | Server write (~1–3 s for typical mixes) then instant start. |
| **Persistence / leaving the app** | Queue lives in the Spotify client; if user starts something else, the remaining mix is gone or interleaved; skip logic stops when our app is backgrounded. | Playlist persists; user can reopen it any time, on any device. |
| **Feature parity with web** | Different mechanism and different edge cases from web. | Identical to web (same playlist, same order, "Open in Spotify" fallback). |
| **Dependencies** | Entirely on the beta, rarely updated App Remote SDK [9]. | Web API (stable) for content; App Remote only for "press play" (can fall back to opening the playlist URL). |

## Recommendation

Go with **(2) the Player playlist on Android**, with App Remote used only to start playback and read player state. It is already built and tested for web, gives exact order with repeats, has no self-stacking leftovers, and keeps both apps on one mechanism. The dummy-start trick does not clear hand-queued songs according to Spotify's own docs and moderators [1][3][4], and the queue approach adds a new failure (old mix leftovers) that (2) does not have.

For hand-queued songs (affects both options): show a one-time hint and, while the app is in the foreground, use PlayerState to detect a track that isn't from the Player playlist context and offer "Skip to mix". Revisit only if spike Test 4 surprisingly shows a playlist start clears Next in queue. This would supersede the "queue-based" decision in ADR-0025 (needs Nishchay's approval).

## Sources

1. Spotify Community FAQ, "How does the Play Queue work?": https://community.spotify.com/t5/FAQs/How-does-the-Play-Queue-work/ta-p/1308142
2. Spotify Community, "Return to playlist after song": https://community.spotify.com/t5/Content-Questions/Return-to-playlist-after-song/td-p/5027820
3. Spotify Community Implemented Ideas, "Clear play queue": https://community.spotify.com/t5/Implemented-Ideas/Clear-play-queue/idi-p/11243
4. Spotify Support, "Play Queue": https://support.spotify.com/us/article/play-queue/
5. Forum, "Clear Queue API": https://community.spotify.com/t5/Spotify-for-Developers/Clear-Queue-API/td-p/6209489
6. Get the User's Queue: https://developer.spotify.com/documentation/web-api/reference/get-queue
7. App Remote PlayerApi reference: https://spotify.github.io/android-sdk/app-remote-lib/docs/com/spotify/android/appremote/api/PlayerApi.html
8. Rate limits: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
9. "Is this SDK still maintained?": https://github.com/spotify/android-sdk/issues/340
