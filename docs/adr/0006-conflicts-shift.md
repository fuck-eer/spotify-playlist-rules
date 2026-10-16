# ADR-0006: Conflicts: higher rule wins, lower rule shifts

Status: Accepted (Nishchay, 2026-10-16)

## Context

Two rules can target the same slot (e.g. pin + repeat, two every-N rules).

## Decision

The higher-priority rule (earlier in the Rule Set) wins the slot. The lower rule's song shifts to the next free slot, and the Preview shows a 'moved from #p' badge.

## Consequences

Nothing is silently dropped. Differs from the mockup, where lower rules skip; the mockup preview must be updated to match. The engine output must include the shift metadata for the preview.
