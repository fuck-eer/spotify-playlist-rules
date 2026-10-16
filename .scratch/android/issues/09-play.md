# 09: Play via the Player playlist (Android)

**What to build:** Play runs the server Play (Player playlist overwrite), then starts it from the first track with shuffle off via App Remote; fallback opens it in Spotify; outcome dialog like web.

**Blocked by:** 05

**Status:** ready-for-agent

**Glossary:** Play, Player playlist, Playback outcome. **ADRs:** 0021, 0022, 0026.

**Files:** `playback/AppRemote.kt` (connect with `showAuthView(false)` after sign-in, connect on `onStart`, disconnect `onStop`, 20 s timeout), `playback/PlayController.kt` (`suspend fun play(mixId): PlayResult`: POST `/api/mixes/{id}/play`, poll run every 1 s until done, then `setShuffle(false)` → `play("spotify:playlist:$playlistId")`; on failure `Intent(ACTION_VIEW, "spotify:playlist:…")`, else https URL), `ui/editor/PlayDialog.kt`.

**Acceptance criteria**
- [ ] Unit tests with fake API + fake remote: success path calls shuffle then play with the run's `playlistId`; remote failure → intent fallback; run failure → error snackbar with Retry.
- [ ] Manual on the phone: Play starts the Player playlist at track 1 with shuffle off.
