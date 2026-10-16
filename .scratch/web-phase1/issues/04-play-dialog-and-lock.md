# 04: Play success dialog and per-user Player playlist lock

**What to build:** per the updated spec ("Mix page", "Per-user lock"): after a successful Play, show a dialog with the outcome text and a tappable "Open in Spotify" link instead of auto-navigating; and create/overwrite the Player playlist under a per-user advisory lock.

**Blocked by:** 03

**Status:** done

- [x] No auto-navigation; `openExternal` removed
- [x] Dialog titles/text per outcome; link `href=https://open.spotify.com/playlist/<id>`, `target=_blank`, `rel` has `noopener`
- [x] `performPlay` wraps lookup + write + id store in a transaction with `pg_advisory_xact_lock`
- [x] Test: two concurrent Plays (two mixes, slow create) → one create call, both runs and the user point at the same playlist (fails without the lock)
- [x] Component tests and Playwright updated
