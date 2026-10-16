# ADR-0005: Rule songs are removed from the base list

Status: **Superseded by ADR-0027** (Nishchay, 2026-10-17). Previously accepted 2026-10-16.

## Context

Plan open question: if a rule's song is also in the source, what happens?

## Decision

A song attached to a rule is removed from the Base list; only the rules decide where it appears.

## Consequences

Output is predictable: the song appears exactly where rules put it.
