# android map

Spec: docs/spec-v2.md (Android). ADRs 0026, 0031–0034.

01 scaffold; 02 engine ← v2-web/01; 03 mobile session API ← ADR-0034 (approved), v2-web/02; 04 sign-in ← 01, 03; 05 list/offline ← 04, v2-web/02; 06 graph ← 02, 05; 07 song sheet ← 06; 08 drag/bench ← 07; 09 Play ← 05; 10 motion ← 08; 11 release APK ← 09 (→ v2-web/09).

## Needs Nishchay
- ~~Approve ADR-0034~~ (approved 2026-10-17). In the Spotify dashboard add redirect `rulemix://callback` and `com.rulemix.app` with the debug and release SHA-1s.
- Keep a backup of the release keystore (losing it means users must uninstall to update).
