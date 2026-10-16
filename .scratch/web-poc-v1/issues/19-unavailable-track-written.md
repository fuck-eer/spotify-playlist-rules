# 19: Unavailable track written to Spotify

**Status:** done
**Type:** bug
**Refs:** manual real-Spotify check on integration 10b7e1f; ADR-0011 (Unavailable tracks skipped + counted)

## Problem
Source "4 strings 2 moods" (own, 26 items) has an item Spotify shows nameless with duration "-:--". The song picker showed a button labelled only "·", and the save wrote it as #2 in the target.

## Diagnosis
Read-only GET of the real playlist items (stored refresh token, app client). Item 20 (index 19):
`{"is_local":false,"item":{"type":"track","uri":"spotify:track:0xkG…","name":"","artists":[{"name":""}],"duration_ms":0,"is_playable":false,"restrictions":{"reason":"market"}}}`
Root cause: `toTrackItem` only rejected local files, non-tracks and missing uris, and `ITEM_FIELDS` didn't even request `is_playable`/`restrictions`. A market-restricted track has a valid `spotify:track:` uri, so it passed as available.

## Decision
- Request `is_playable,restrictions` in the playlist items fields filter (Liked Songs already returns full objects).
- A track with `is_playable === false`, any `restrictions`, or an empty name is an Unavailable track (null): skipped on save, counted in "N songs skipped", hidden from the song picker (`uniqueAvailable`).

## Tests (write first)
- readers (fake server): the exact captured shape maps to null; also `is_playable:false`, a restriction, an empty name; `is_playable:true` stays; the fields filter includes the new fields.
- songs route (fake server): the captured shape is not offered in the picker.

## Acceptance criteria
- [x] The real playlist reads as 25 available + 1 unavailable (re-verified read-only)
- [x] All tests pass
