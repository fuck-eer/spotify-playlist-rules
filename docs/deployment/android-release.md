# Android release (ADR-0033)

- Keystore (outside the repo, on the box): `~/keys/rulemix-release.jks` (PKCS12, alias `rulemix`, RSA 4096, 10000 days).
- Credentials (outside the repo, mode 600): `~/keys/rulemix-release.properties` with
  `RULEMIX_KEYSTORE`, `RULEMIX_KEYSTORE_PASSWORD`, `RULEMIX_KEY_ALIAS`, `RULEMIX_KEY_PASSWORD`.
  Nishchay: back both files up somewhere safe; losing them means users must uninstall to update.
- Build and publish:
  `RULEMIX_SIGNING_FILE=~/keys/rulemix-release.properties SPOTIFY_ENV_FILE=apps/web/.env.local ANDROID_HOME=~/tools/android scripts/android-release.sh`
  → `apps/web/public/android/rulemix.apk`, verified with `apksigner verify`.

## Spotify dashboard (Nishchay registers these)

- Redirect URI: `rulemix://callback`
- Android package: `com.rulemix.app`
- Debug SHA-1 (`~/.android/debug.keystore`): `9A:99:3A:59:DA:D4:2B:0B:C6:D8:F8:CF:B9:8C:40:9D:33:2A:06:03`
- Release SHA-1 (`~/keys/rulemix-release.jks`): `06:17:97:A1:EA:A1:6F:76:60:7C:9C:E7:52:DE:A2:D8:30:B9:D1:66`
