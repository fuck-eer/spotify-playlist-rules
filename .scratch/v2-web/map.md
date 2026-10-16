# v2-web map

Spec: docs/spec-v2.md. ADRs 0026–0031, 0033.

01 engine → 02 arrangement API → {03 Play/Save, 04 graph}; 04 → {05 popover, 06 drag}; 06 → 07 bench; {05, 07} → 08 motion. 09 button ← android/11.

## Decisions I made (Nishchay may override)
1. Every-N counts graph nodes, so a Repeat stack counts as one slot (prototype behaviour). His words were "counts the final playlist"; strict play-counting is the alternative.
2. A rule whose song is not in the Source (deleted, or Unavailable; the engine can't tell them apart) still places its Start with / every-N copies, with a warning. Supersedes A2 / ADR-0011's "places nothing".
3. A Repeat whose song isn't on the line (benched, or deleted from the Source) places nothing.
4. Duplicate songs in a Source collapse to one Original song.
5. Deleted copies are keyed by Mix rule id + copy number (not rule position), so reordering rules doesn't re-target them. A copy number can point at a different grid slot if the line length changes.
6. Sync conflicts: version check, a stale write gets 409, and the client reloads. No merging.
7. The APK is committed to `apps/web/public/android/` (about 5 MB per release, in git history).
