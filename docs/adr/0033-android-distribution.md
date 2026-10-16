# ADR-0033: Android distribution: signed APK from rulemix.vercel.app

Status: Accepted (Nishchay, 2026-10-17).

## Decision

- A release-signed APK is downloadable from rulemix.vercel.app via a "Get the Android app" button.
- **Later phase:** a landing page that shows the Android download only to Android visitors; everyone else goes straight to "Sign in with Spotify".
- Play Store is out of scope.

## Consequences

- A release keystore is needed; its SHA-1 must be registered with the package in the Spotify dashboard (Nishchay's action).
- Users must allow installing unknown apps. Updates are manual (re-download).
