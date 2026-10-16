# Android queue spike (throwaway)

Tests whether the **Spotify App Remote SDK** can (1) play an exact sequence with repeats,
(2) clear or replace the queue, (3) report player state. Not production code.

| | |
|---|---|
| Package | `com.rulemix.spike` |
| Redirect URI | `rulemix-spike://callback` |
| Debug SHA1 | `9A:99:3A:59:DA:D4:2B:0B:C6:D8:F8:CF:B9:8C:40:9D:33:2A:06:03` |
| SDK | spotify-app-remote **0.8.0**, spotify-auth **2.1.0** (GitHub release `v0.8.0-appremote_v2.1.0-auth`, 2023-07-04 — still the latest) |
| APK | `/workspace/rulemix-spike.apk` (box) |

The SHA1 belongs to the box's `~/.android/debug.keystore`. If that keystore is regenerated, the SHA1 changes and must be re-registered.

## What Nishchay must do

1. Open https://developer.spotify.com/dashboard → the rulemix app → **Settings → Edit**.
2. **Redirect URIs**: add `rulemix-spike://callback` (keep the existing web one).
3. **APIs used**: tick **Android**. Under **Android packages** add package
   `com.rulemix.spike` with SHA1 `9A:99:3A:59:DA:D4:2B:0B:C6:D8:F8:CF:B9:8C:40:9D:33:2A:06:03`. Save.
4. Install the APK on the OnePlus 12 (allow "install unknown apps" for whatever you use to open it, or `adb install rulemix-spike.apk`).
5. Open Spotify once (logged in, Premium), then open **rulemix spike** and tap **LOGIN** (explicit auth via AuthorizationClient). On success it connects App Remote with `showAuthView(false)`. If LOGIN does nothing, try **LOGIN (browser)**. Connect has a 20 s timeout that logs `connect timed out`. It no longer auto-connects in onStart.
6. Tap **Test 1**, then tap **Next ⏭** four times. The log prints each track change and a `SEQUENCE so far:` line. Expected if repeats work: `A,B,B,C,A`.
7. Tap **Test 2**, then **Next ⏭** once: if the next track is Demons (C), `play()` does **not** clear the queue.
8. **Test 3** dumps the current PlayerState. Screenshot or copy the log (it's selectable) and send it back.

Tracks (QA test playlist): A=Hypocrite `1QuXuJFFDlWb7NqbPo1jwA`, B=Kissing Mouths `2ahVlPHe8XlXKFjL2zZLPD`, C=Demons `5qaEfEh1AtSdrdrByCP7qR`, D=Run Closer `40rO5T5aZa0MlgzCetTRTn`.

## Expected per docs

- `PlayerApi` methods: `play(uri)`, `play(uri, streamType)`, `queue(uri)`, `pause`, `resume`, `skipNext`, `skipPrevious`, `skipToIndex(contextUri, index)`, `setShuffle`, `setRepeat`, `getPlayerState`, `subscribeToPlayerState`, `subscribeToPlayerContext`. [1]
  - **No `clearQueue`, no `getQueue`, no "play list of URIs".** So (2) clear/replace is **not expected to be possible** directly; the test checks whether `play()` implicitly drops queued items. [1]
  - `play()` takes one URI (track/album/playlist/artist). `queue()` takes a track URI. Sequence with repeats = `play(A)` + `queue(B)×2…`; whether duplicates are kept is undocumented, which is what Test 1 measures. [1][2]
- PlayerState (track, paused, position, playbackOptions shuffle/repeat, restrictions) is pushed via `subscribeToPlayerState`, so (3) is expected to work. [1][3]
- Requirements: Spotify app installed, user logged in; Premium needed for on-demand play/queue (free users get shuffle-only restrictions). Package name + SHA1 must be registered in the dashboard. [2][3]
- SDK is labelled **beta**; last release July 2023. [4]

Sources:
1. PlayerApi reference — https://spotify.github.io/android-sdk/app-remote-lib/docs/com/spotify/android/appremote/api/PlayerApi.html
2. Android SDK getting started — https://developer.spotify.com/documentation/android/tutorials/getting-started
3. Android SDK overview — https://developer.spotify.com/documentation/android
4. Releases — https://github.com/spotify/android-sdk/releases

## Build

JDK 17, Android SDK 34 and Gradle are in `~/tools` on the box.
```
export JAVA_HOME=~/tools/jdk ANDROID_HOME=~/tools/android
echo "sdk.dir=$ANDROID_HOME" > local.properties
SPOTIFY_ENV_FILE=../../apps/web/.env.local ./gradlew assembleDebug
```
The client ID is read at build time from `SPOTIFY_CLIENT_ID` or `SPOTIFY_ENV_FILE` and is never committed.

## v0.2: the "Connecting…" hang

v0.1 hung forever on the OnePlus 12. Known cause on Android 14+: when the app targets SDK 34, the OS blocks Spotify from opening its auth screen from the background, so `connect()` never calls back ([#361](https://github.com/spotify/android-sdk/issues/361), [#377](https://github.com/spotify/android-sdk/issues/377), [#348](https://github.com/spotify/android-sdk/issues/348)). v0.2 adds explicit foreground auth first, lowers targetSdk to 33, adds a 20 s timeout and guards against a double connect.

## Results (OnePlus 12, 2026-10-17)

- **LOGIN then CONNECT works** (v0.2: explicit auth, targetSdk 33).
- **Test 1:** `play(A)` + `queue(B)`, `queue(B)`, `queue(C)`, `queue(A)` played **A, B, B, C, A by ear**: exact sequence with repeats ✅. The v0.2 log showed `A,B,C,A` because it logged only on URI change; v0.3 also counts a position reset on the same URI as a new play.
- **Test 2:** `queue(C)`, `queue(C)`, then `play(D)`; the next track was C. So **`play()` does NOT clear the queue**, and the SDK has no clear-queue method ❌.
- **Player state:** pushed via `subscribeToPlayerState` ✅.
- The app disconnects in `onStop`, as Spotify recommends ([lifecycle docs](https://developer.spotify.com/documentation/android/tutorials/application-lifecycle)). Backgrounding the app drops the connection, so monitoring or skipping logic only runs while the app is visible unless the real app uses a service.

Decision: the Android app is queue-based; see ADR-0025.
