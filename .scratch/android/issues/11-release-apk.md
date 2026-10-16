# 11: Signed release APK published on the web app

**What to build:** a release-signed APK built reproducibly and copied to `apps/web/public/android/rulemix.apk`.

**Blocked by:** 09

**Status:** ready-for-agent

**ADRs:** 0033.

**Files:** `apps/android/app/build.gradle.kts` (`signingConfigs.release` from env `RULEMIX_KEYSTORE`, `RULEMIX_KEYSTORE_PASSWORD`, `RULEMIX_KEY_ALIAS`, `RULEMIX_KEY_PASSWORD`; never committed); `scripts/android-release.sh` (assembleRelease, `apksigner verify`, copy APK, print SHA-1); keystore at `~/.android/rulemix-release.jks` on the box (generated once with `keytool`, backed up by Nishchay).

**Acceptance criteria**
- [ ] `apksigner verify` passes; APK installs on the phone over the debug build's absence.
- [ ] Release SHA-1 printed and added to `docs/deployment/` for Nishchay to register in the Spotify dashboard with `com.rulemix.app`.
