> Exported from Notion: https://app.notion.com/p/3fa425073e24810782c7efdca91fc3f3 (fetched 2026-10-16)

# 🎵 Spotify Playlist Rules: Plan

## Problem
Music controls never moved past play, pause and skip. I want user-set rules on my playlists, not AI shuffle.
## Decisions
- Personal tool for now (Spotify dev mode, up to 5 users). Possibly package it for others with Spotify OAuth later.
- No live playback control. The rule engine generates a "Rules: \<name\>" playlist through the Web API, and I play it in the normal Spotify app with shuffle off.
- Regenerate on demand first. Nightly regeneration comes later, because it needs an always-on server holding a refresh token.
- v1 rule types: pin first, insert every N, and repeat N times.
- Rule priority comes from rule order, with a preview of the final order.
## Sources
- Works: owned playlists, collaborative playlists, and Liked Songs.
- Doesn't work: other users' playlists and Spotify-made ones (Discover Weekly, Daily Mix, editorial). Workaround: manually copy them into an owned playlist in the Spotify app. It's a snapshot, and this source probably won't get used much.
## How it works
1. Read the source tracks: GET /v1/playlists/\{id\}/items (50 per page) or GET /v1/me/tracks.
2. Build the ordered list on the device with the rule engine (duplicates allowed).
3. Create the "Rules: \<name\>" playlist once (POST /v1/me/playlists).
4. Each regeneration: PUT the first 100 items to /v1/playlists/\{id\}/items, then POST the rest in chunks of 100.
5. Scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-private, user-library-read.
## UI
- **Original idea:** two dashboards. (1) Rule library: create rules. (2) Rule set builder: drag rules in, pick the song for each, and order them by priority.
- **Devil's Advocate's suggestion for v1:** a single screen. Pick the source, add rules from the 3 types, set the song and N, drag to reorder, and preview the result. Or use a config file plus a script for the first week. Revisit the two-dashboard design once rule types become user-defined.
## Decisions still open
- [ ] **Base order:** keep the source order, or reshuffle the non-rule songs on every regeneration (variety)?
- [ ] **Collisions:** if a rule's song is also in the source, remove it from the base list?
- [ ] **Conflicts:** define what happens with the same song pinned and repeated, or two every-N rules on the same slot. Show the result in the preview.
## Risks and things to expect
- Duplicate URIs are allowed in practice but not explicitly documented. Test first.
- Regenerating while listening can make Spotify jump or skip.
- Spotify autoplay starts unrelated songs after the last track.
- Dev mode: 5-user cap, the app owner needs Premium; end users likely don't (unconfirmed).
- Policy II.2: keep heavy repeats moderate to avoid looking like play inflation.
- Public launch is effectively closed (extended quota needs 250k MAU; no monetisation).
## Plan
### Step 1: Script spike (first day)
- [ ] Register a Spotify dev app and set up PKCE auth.
- [ ] Test duplicate URIs and the PUT-then-POST regeneration flow on a test playlist.
- [ ] Write the rule engine as a pure, unit-tested function (pin first, every N, repeat).
- [ ] Rules in a config file, and a script that generates one "Rules:" playlist from a real playlist.
### Step 2: Listen for a week
- [ ] Use it daily and note which rules I actually tweak.
- [ ] Settle base order, collisions and conflicts.
### Step 3: UI
- [ ] Build the single-screen UI with a regenerate button and a preview, based on what I tweaked in Step 2.
### Later
- [ ] Nightly regeneration (server and refresh token).
- [ ] Two-dashboard design with user-defined rule types.
- [ ] OAuth packaging for friends.
## Designs
- DSN-20261016-playlist-rules: [Design doc](https://app.notion.com/p/3fb425073e2481e5bdf2f20cbd1a186a) (mobile HTML mockup)
- Architecture: [Spotify Playlist Rules architecture](https://app.notion.com/p/3fa425073e24819aaa25e7cd7da6ae3c)
## Requirement updates (16 Oct 2026)
- **Rules hold intent only, with no song.** A rule in the global library is just the action and its parameters, e.g. "play N times", "insert every N songs", "pin first". Every rule must attach to a song, so song-less rules like "skip every N" are out. The song is chosen when the rule is added to a session's rule set, picked from that session's playlist. One rule can be reused across playlists.
- **Deleting rules:** you can't delete a rule that any session uses; the app suggests archiving it instead.
- **Repeat** plays the song back to back.
- **Visual rule language:** the playlist is shown as dots joined by a line, one dot per song. Each rule in a rule set gets its own colour, and the affected song's dot takes that colour. Rule effects are drawn graphically, e.g. pin first is the first dot in green, and play twice is an orange dot with a self-loop arrow labelled "2×". The rule builder shows the same style of graphic for the rule's intent, and the rule set and preview show it on the real playlist. No boxy cards.
