# ADR-0015: One Target playlist per Mix, tracked by ID

Status: Accepted (Nishchay, 2026-10-16)

## Context

Each Mix writes to a playlist; users may rename it in Spotify.

## Decision

One Target playlist per Mix, tracked by playlist ID. Default name 'Rules: <mix name>'. Renaming it in Spotify is safe because the app never looks it up by name.

## Consequences

The Mix stores target_playlist_id; the app does not rename the playlist after creation.
