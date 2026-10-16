# ADR-0029: Rule copies keep their slots

Status: Accepted (Nishchay, 2026-10-17). Refines ADR-0007.

## Decision

- Rule copies are not draggable. When an Original song is dragged, Rule copies stay in their slots and only Original songs shift around them.
- Start with stays at slot 1.
- Insert every N stays on its grid, counted over the **final** list (Original songs plus all copies), as in ADR-0007.

- Rule copies are never benched. Trashing one deletes just that copy (a skipped every-N slot, or a Repeat count lowered by one), and it stays removed across Reshuffle (ADR-0030).

## Consequences

The engine places Rule copies first at fixed slots, then fills the remaining slots with Original songs in Manual (or seeded) order.
