# 01: Android app scaffold, theme tokens, CI build

**What to build:** an installable `rulemix` debug app showing the v2 sign-in screen (static), built by CI.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**ADRs:** 0031, 0032. **Design:** `tokens.json`, `android-notes.md` (Tokens, Gradients), shot `mobile.png`.

**Files**
- `apps/android/settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, wrapper (Gradle 8.7, JDK 17, AGP for compileSdk 34).
- `apps/android/app/build.gradle.kts`: `applicationId = "com.rulemix.app"`, minSdk 26, targetSdk 33 (App Remote / Android 14 workaround, ADR-0025 context), Compose + M3, `libs/spotify-app-remote-release-0.8.0.aar`, `libs/spotify-auth-release-2.1.0.aar` (copied from `spikes/android-queue/app/libs`), gson, androidx.browser; `BuildConfig.API_BASE_URL` (default `https://rulemix.vercel.app`), `SPOTIFY_CLIENT_ID` read from env like the spike.
- `app/src/main/java/com/rulemix/app/ui/theme/{Color.kt,Type.kt,Theme.kt,RulePalette.kt}` from tokens.json (Figtree font).
- `app/src/main/java/com/rulemix/app/ui/motion/Motion.kt`: `object Motion { val snap = spring<Float>(dampingRatio = 0.82f, stiffness = 600f); val pop = spring<Float>(0.71f, 800f); val sheet = spring<Float>(0.94f, 500f); val easeOut = tween<Float>(240, easing = CubicBezierEasing(.2f, .8f, .2f, 1f)) }` plus `reducedMotion()` from `ANIMATOR_DURATION_SCALE == 0`.
- `MainActivity.kt` + `ui/signin/SignInScreen.kt` (static).
- `.github/workflows/android.yml`: `./gradlew :app:assembleDebug :engine:test` on PRs touching `apps/android/**` or `packages/rules-engine/fixtures/**`.
- Root `README.md`: Android build section (`~/tools` on the box).

**Acceptance criteria**
- [ ] `./gradlew :app:assembleDebug` succeeds locally and in CI; the app launches to the sign-in screen styled per tokens.
- [ ] A Compose UI test asserts the "Sign in with Spotify" button exists.
