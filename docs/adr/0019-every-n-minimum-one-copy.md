# ADR-0019: Every-N always places at least one copy

Status: Accepted (Nishchay, 2026-10-16)

## Context

Every N placed floor(B/N) copies (ADR-0007). With a small Base list (B < N, including B = 0) that is zero, so the rule silently did nothing and the saved playlist looked wrong.

## Decision

An every-N rule places max(1, floor(B/N)) copies. Positions stay k·(N+1)−1, clamped to the last slot (L−1) when they fall past the end; a clamped slot that is taken shifts like any other conflict (ADR-0006).

## Consequences

Every active rule now always contributes at least one slot, so `rulesApplied` counts every active rule. The shared fixtures 12 and 13 cover this.
