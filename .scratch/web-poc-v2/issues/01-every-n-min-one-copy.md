# 01: Every N places nothing on a small source

**Status:** done
**Type:** bug
**Refs:** Nishchay feedback on the deployed POC (Testmix); ADR-0007, ADR-0019

## Problem
Every N placed floor(B/N) copies, so with B < N (or B = 0) the rule did nothing and the save wrote only the pinned song.

## Decision
copies = max(1, floor(B/N)); positions k·(N+1)−1 clamped to L−1 (ADR-0019).

## Tests (write first)
- unit: B < N → 1 copy; B = 0 → 1 copy; clamped fixture 12 updated; new fixture 13.
- property: for B in 0..12 and N in 2..10, X appears max(1, floor(B/N)) times and length = B + that.

## Acceptance criteria
- [x] Spec + ADR-0019 updated
- [x] All tests pass
