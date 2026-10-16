# ADR-0028: Manual order of Original songs, saved per Mix

Status: Accepted (Nishchay, 2026-10-17).

## Context

The v2 design lets users drag songs. This conflicts with "same seed + same rules = same output" unless the custom order is stored.

## Decision

- Only Original songs (grey ring) can be dragged. Dragging works with or without rules.
- A drag saves a **Manual order** of the Original songs. It replaces the seeded base order for that Mix.
- The Manual order and the Bench (ADR-0030) are saved per Mix on the server and synced between web and Android.
- **Reshuffle** clears the Manual order and picks a new seed. It does not restore benched songs.

## Source playlist changes (decided 2026-10-17)

- The saved Manual order and the Bench (ADR-0030) are kept.
- Songs newly added to the Spotify Source playlist are appended at the end of the line, after the Manual order (in Source order).
- Songs deleted from the Spotify Source playlist are dropped entirely: removed from the Manual order and the Bench, not stored. Their Rule copies stay.
- With no Manual order (seeded order), the seed simply applies to the current Source.

## Consequences

Data model: a per-Mix ordered list of Original track URIs (or null for "use seed"). The engine takes it as an input in place of the shuffled base.
