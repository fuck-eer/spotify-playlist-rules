#!/usr/bin/env bash
# Builds the release-signed APK and publishes it to apps/web/public/android/rulemix.apk.
# Needs RULEMIX_KEYSTORE, RULEMIX_KEYSTORE_PASSWORD, RULEMIX_KEY_ALIAS, RULEMIX_KEY_PASSWORD
# (or RULEMIX_SIGNING_FILE pointing at a KEY=VALUE file with them, kept outside the repo).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -n "${RULEMIX_SIGNING_FILE:-}" ]]; then set -a; source "$RULEMIX_SIGNING_FILE"; set +a; fi
: "${RULEMIX_KEYSTORE:?set RULEMIX_KEYSTORE (or RULEMIX_SIGNING_FILE)}"
: "${ANDROID_HOME:?set ANDROID_HOME}"
cd "$root/apps/android"
./gradlew -q :app:assembleRelease
apk=app/build/outputs/apk/release/app-release.apk
bt="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
"$bt/apksigner" verify --verbose "$apk" | grep -E "Verified|v2 scheme"
mkdir -p "$root/apps/web/public/android"
cp "$apk" "$root/apps/web/public/android/rulemix.apk"
echo "APK: $root/apps/web/public/android/rulemix.apk"
keytool -list -v -keystore "$RULEMIX_KEYSTORE" -storepass "$RULEMIX_KEYSTORE_PASSWORD" -alias "$RULEMIX_KEY_ALIAS" | grep -E "SHA1:"
