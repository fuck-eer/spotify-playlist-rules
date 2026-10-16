# web-poc-v1 ticket map

Spec: docs/spec.md. All tickets: `issues/NN-*.md`, Status ready-for-agent.

| # | Title | Blocked by |
|---|---|---|
| 01 | Monorepo scaffold | none |
| 02 | Rules engine + fixtures | 01 |
| 03 | DB schema + migrations | 01 |
| 04 | Spotify client + readers | 01 |
| 05 | Spotify writer | 04 |
| 06 | Sign in with Spotify | 03, 04 |
| 07 | Design system + dot renderer | 01 |
| 08 | Rules library + editor | 02, 03, 06, 07 |
| 09 | Mixes + Source picker | 03, 04, 06, 07 |
| 10 | Rule Set in a Mix | 08, 09 |
| 11 | Preview + Regenerate | 02, 10 |
| 12 | Save to Spotify | 05, 11 |

Parallel after 01: 02, 03, 04, 07. Then 05 and 06 (after 03 and 04). Then 08 and 09 in parallel.
