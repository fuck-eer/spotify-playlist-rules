# ADR-0020: Every-N merges into a slot that already plays its song

Status: Accepted (Nishchay, 2026-10-16)

## Context

Two rules can target the same song (for example Pin first + Every 2 on song A, or Repeat + Every N). When an every-N position lands on a slot already claimed by a higher rule for the same song, shifting would place two copies of the song back to back for no reason, and the Preview could not show that both rules apply there.

## Decision

- While claiming slots, if an **every-N** rule's position is already taken by a copy of **the same song**, the rule merges into that slot instead of shifting. The slot records every rule that claimed it.
- Any other taken slot (different song, or a pin/repeat rule) still shifts (ADR-0006).
- Each merge saves one slot: the final length is B + sum of rule counts − merges. The unused free slots are the last ones and are dropped.
- `PreviewSlot` gains `ruleIndices: number[]` (priority order; empty for Base songs). `ruleIndex` stays as `ruleIndices[0]` (or null).
- The Preview draws a merged slot as a split dot: equal segments, one per rule, in each rule's colour. All other slots keep their own rule's colour.

## Consequences

The "each rule places its count" property counts slots whose `ruleIndices` include the rule. Fixture 14 covers a merge. Kotlin port must do the same.
