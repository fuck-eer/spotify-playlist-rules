# ADR-0030: Removing songs: the Bench

Status: Accepted (Nishchay, 2026-10-17). Updated 2026-10-17: "Removed list" renamed **Bench**; Source-change behaviour decided; only Original songs are benched (Nishchay via UI Designer).

## Decision

- Any song, Original or Rule copy, can be removed by dragging it to the trash icon that appears in a corner while dragging. (Rule copies can't be reordered, but they can be dragged onto the trash.)
- Trashed **Original songs** (only) go to the Mix's **Bench** (FIFA team-management metaphor). Benched songs stay in the Mix's data but are not played or written.
- The Bench is shown as a cluster of free nodes in the **bottom-right corner of the graph**, off the line. Tapping the cluster opens the Bench.
- Dragging an Original song from the Bench back onto the line restores it at the drop position. It then becomes a normal Original song (reorderable; the drop updates the Manual order, ADR-0028).
- **Rule copies never go to the Bench.** Trashing a Rule copy deletes just that copy; the rule keeps applying elsewhere:
  - one Insert every N copy → only that slot is skipped; the other copies stay;
  - one play of a stacked Repeat (xN) → its count drops by one; at 1 the rule disappears and the single remaining song stays.
- A removed Rule copy stays removed across Reshuffle (stored as a skipped every-N slot or a lowered Repeat count). It is not restorable from the Bench. This supersedes the earlier grill wording (Q8) that a trashed every-N copy is "restorable from the Removed list".
- Benched songs stay benched across Reshuffle until restored.
- Rule copies survive their Original song's removal.
- The Bench is saved per Mix on the server and synced web/Android (ADR-0028).

## Source playlist changes

- The Bench is kept.
- A song deleted from the Spotify Source playlist is dropped entirely: removed from the line, the Manual order and the Bench (not stored). Its Rule copies stay.
- Newly added Source songs are handled per ADR-0028 (appended at the end of the line).
