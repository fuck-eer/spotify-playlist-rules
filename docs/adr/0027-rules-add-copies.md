# ADR-0027: Rules add copies; the Original song stays

Status: Accepted (Nishchay, 2026-10-17). Supersedes ADR-0005.

## Context

ADR-0005 removed a rule's song from the Base list so only the rules placed it. The v2 interactive design treats rules as adding to the playlist, not replacing songs in it.

## Decision

- A rule never removes its song from the list. The Original song stays at its own position, and the rule adds **Rule copies** (Start with adds a copy at slot 1, Insert every N adds copies on its grid, Repeat N adds copies back to back).
- A Rule copy survives the removal of its Original song (ADR-0030).

## Consequences

- Same-seed output changes for existing Mixes with rules: each rule's song now appears once more. The engine, its fixtures and the Preview need updating.
- ADR-0019 (every-N places at least one copy) and ADR-0020 (same-slot merge) still apply, to copies.
