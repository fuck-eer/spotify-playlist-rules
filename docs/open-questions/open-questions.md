# Open questions: Spotify Playlist Rules

> Copied verbatim from [docs/plan/plan.md](../plan/plan.md) (Notion https://app.notion.com/p/3fa425073e24810782c7efdca91fc3f3), 2026-10-16.

## Decisions still open
- [ ] **Base order:** keep the source order, or reshuffle the non-rule songs on every regeneration (variety)?
- [ ] **Collisions:** if a rule's song is also in the source, remove it from the base list?
- [ ] **Conflicts:** define what happens with the same song pinned and repeated, or two every-N rules on the same slot. Show the result in the preview.

## Requirement updates (16 Oct 2026)
- **Rules hold intent only, with no song.** A rule in the global library is just the action and its parameters, e.g. "play N times", "insert every N songs", "pin first". Every rule must attach to a song, so song-less rules like "skip every N" are out. The song is chosen when the rule is added to a session's rule set, picked from that session's playlist. One rule can be reused across playlists.
- **Deleting rules:** you can't delete a rule that any session uses; the app suggests archiving it instead.
- **Repeat** plays the song back to back.
- **Visual rule language:** the playlist is shown as dots joined by a line, one dot per song. Each rule in a rule set gets its own colour, and the affected song's dot takes that colour. Rule effects are drawn graphically, e.g. pin first is the first dot in green, and play twice is an orange dot with a self-loop arrow labelled "2×". The rule builder shows the same style of graphic for the rule's intent, and the rule set and preview show it on the real playlist. No boxy cards.
