# 02: Two rules on one song: merge and split dot

**Status:** done
**Type:** feature
**Refs:** Nishchay feedback; ADR-0006, ADR-0020

## Problem
Two rules on the same song showed only the first rule's colour, and an every-N copy landing on the same song's slot was shifted instead of shared.

## Decision
- Engine: `PreviewSlot.ruleIndices` (priority order). An every-N position already holding a copy of the same song merges into it (one slot fewer); everything else still shifts (ADR-0020).
- Dots: a slot with 2+ rules renders as equal wedges in each rule's colour, label `#1+#2`. Merged slots never collapse into a repeat loop.

## Tests (write first)
- engine unit + fixture 14 (repeat 3 + every 2 on the same song); different-song still shifts; property: ruleIndex = ruleIndices[0], all rules on a slot share its song, counts via ruleIndices.
- previewToDots: merged slot → `colors`; DotLine: 2 and 3 segments.

## Acceptance criteria
- [x] Spec + ADR-0020 updated
- [x] All tests pass
