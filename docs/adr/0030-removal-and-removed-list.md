# ADR-0030: Removing songs, and the Removed list

Status: Accepted (Nishchay, 2026-10-17).

## Decision

- Any song, Original or Rule copy, can be removed by dragging it to the trash icon that appears in a corner while dragging. (Rule copies can't be reordered, but they can be dragged onto the trash.)
- Removed Original songs go to the Mix's **Removed list**. They stay removed across Reshuffle until the user restores them from that list.
- Trashing one Insert every N copy removes only that slot; the other copies stay.
- Trashing a stacked Repeat (xN) lowers its count by one. At 1 the rule disappears and the single remaining song stays.
- Rule copies survive their Original song's removal.
- The Removed list is saved per Mix and synced (ADR-0028).

## Open

Behaviour when the Source playlist changes (a removed or reordered song disappears from, or is re-added to, the Source) is not decided yet.
