# 04: Saved dialog + Open in Spotify

**Status:** done
**Type:** feature
**Refs:** Nishchay feedback

## Decision
- After a successful save, a shadcn Dialog shows a link to `https://open.spotify.com/playlist/<id>` (new tab) and an "Open in Spotify" button.
- The mix page shows a persistent "Open in Spotify" link whenever the mix has a target playlist id.

## Tests (write first)
- component: save done → dialog with link/button (target=_blank, rel=noopener); persistent link shown iff target id.

## Acceptance criteria
- [x] All tests pass
