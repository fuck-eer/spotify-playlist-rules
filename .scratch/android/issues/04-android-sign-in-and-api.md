# 04: Android sign-in, token storage, API client

**What to build:** tapping "Sign in with Spotify" logs in through the Spotify app, gets a rulemix session token and lands on an (empty) Mix list; sign out works; Spotify-not-installed message with Play Store button.

**Blocked by:** 01, 03

**Status:** ready-for-agent once 03 is unblocked

**ADRs:** 0032, 0034.

**Files**
- `app/.../auth/SpotifyLogin.kt`: `AuthorizationClient.openLoginActivity(activity, REQ, AuthorizationRequest.Builder(CLIENT_ID, Type.CODE, "rulemix://callback").setScopes(SCOPES))`; `SCOPES` = web scopes + `app-remote-control`.
- Manifest: redirect scheme `rulemix` host `callback` placeholders; `<queries>` for `com.spotify.music` (as spike).
- `app/.../data/TokenStore.kt` (EncryptedSharedPreferences); `app/.../data/Api.kt` (OkHttp + kotlinx.serialization, Bearer interceptor, 401 → signed-out state); `AuthRepository.signIn(code)`, `signOut()`.
- `ui/signin/SignInScreen.kt`, `ui/common/SpotifyMissing.kt` (text + button `market://details?id=com.spotify.music`, fallback `https://play.google.com/store/apps/details?id=com.spotify.music`).

**Acceptance criteria**
- [ ] MockWebServer tests: sign-in POST body, token persisted, Bearer header sent, 401 clears token.
- [ ] Compose test: Spotify missing → message and button visible.
- [ ] Manual on the OnePlus 12 (debug keystore SHA-1 registered): sign in → Mix list.
