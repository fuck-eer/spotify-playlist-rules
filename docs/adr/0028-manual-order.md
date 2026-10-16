# ADR-0028: Manual order of Original songs, saved per Mix

Status: Accepted (Nishchay, 2026-10-17).

## Context

The v2 design lets users drag songs. This conflicts with "same seed + same rules = same output" unless the custom order is stored.

## Decision

- Only Original songs (grey ring) can be dragged. Dragging works with or without rules.
- A drag saves a **Manual order** of the Original songs. It replaces the seeded base order for that Mix.
- The Manual order and the Removed list (ADR-0030) are saved per Mix on the server and synced between web and Android.
- **Reshuffle** clears the Manual order and picks a new seed. It does not restore removed songs.

## Open

What happens to the Manual order when the Source playlist changes (songs added or removed in Spotify) is not decided yet.

## Consequences

Data model: a per-Mix ordered list of Original track URIs (or null for "use seed"). The engine takes it as an input in place of the shuffled base.
