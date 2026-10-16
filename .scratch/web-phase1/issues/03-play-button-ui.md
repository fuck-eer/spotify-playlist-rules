# 03: Play button on the Mix page

**What to build:** the Mix page's bottom bar per the spec's "Mix page" decision: green Play (primary) + neutral Save to Spotify, progress for either run, toast per outcome, open the Player playlist link on success, re-login hint without playback scopes.

**Blocked by:** 02

**Status:** done

- [x] Mix page passes `canAutoPlay` from stored `users.scopes` via `hasPlaybackScopes`
- [x] `openExternal(url)` in `apps/web/lib/open-external.ts` (calls `window.location.assign`)
- [x] Component tests: Play posts `/play`, polls `/save/<runId>`, toast copy per outcome, `openExternal("https://open.spotify.com/playlist/<id>")` once on success; failed Play → error toast with Retry; hint + `/api/auth/login` link shown only when `canAutoPlay` is false; both buttons disabled while running; existing Save tests still pass
- [x] Playwright: Play on a seeded mix navigates to `https://open.spotify.com/playlist/…` (route intercepted); existing save spec passes
