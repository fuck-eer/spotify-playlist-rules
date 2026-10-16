# ADR-0032: Android accounts, sync, offline and screens

Status: Accepted (Nishchay, 2026-10-17).

## Decision

- **Accounts:** anyone signs in with their own Spotify account. Data is keyed by the Spotify user id on the same rulemix server and database as web, so Mixes, Rules, Manual order and Bench sync across web and Android.
- **Offline:** the app shows the last synced Mixes (list and graph) read-only. Editing and Play need a network connection.
- **Spotify not installed:** the app shows a short message with a Play Store install button (`market://details?id=com.spotify.music`, falling back to the https Play Store URL).
- **Screens:** the same screens and flow as web (sign in, Mix list, Mix editor with the cover graph, Play), following the v2 mobile layouts in `designs/DSN-20261016-playlist-rules-v2/`.

## Consequences

- The backend needs a non-cookie way for the app to authenticate (proposal: ADR-0034).
- The app keeps a local read-only cache of the last fetched Mix list and Mix states.
