# ADR-0030: Removing songs: the Bench

Status: Accepted (Nishchay, 2026-10-17). Updated 2026-10-17: "Removed list" renamed **Bench**; Source-change behaviour decided.

## Decision

- Any song, Original or Rule copy, can be removed by dragging it to the trash icon that appears in a corner while dragging. (Rule copies can't be reordered, but they can be dragged onto the trash.)
- Trashed songs go to the Mix's **Bench** (FIFA team-management metaphor). Benched songs stay in the Mix's data but are not played or written.
- The Bench is shown as a cluster of free nodes in the **bottom-right corner of the graph**, off the line. Tapping the cluster opens the Bench.
- Dragging an Original song from the Bench back onto the line restores it at the drop position. It then becomes a normal Original song (reorderable; the drop updates the Manual order, ADR-0028).
- **Assumed, pending user confirmation:** a benched Rule copy keeps its rule colour, and when dragged back onto the line it snaps to its rule's slot, not the drop point (Rule copies keep their slots, ADR-0029).
- Benched songs stay benched across Reshuffle until restored.
- Trashing one Insert every N copy removes only that slot; the other copies stay.
- Trashing a stacked Repeat (xN) lowers its count by one. At 1 the rule disappears and the single remaining song stays.
- Rule copies survive their Original song's removal.
- The Bench is saved per Mix on the server and synced web/Android (ADR-0028).

## Source playlist changes

- The Bench is kept.
- A song deleted from the Spotify Source playlist is dropped entirely: removed from the line, the Manual order and the Bench (not stored). Its Rule copies stay.
- Newly added Source songs are handled per ADR-0028 (appended at the end of the line).
