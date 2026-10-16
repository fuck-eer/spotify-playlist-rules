# 06: Mix editor with the cover graph (read-only render)

**What to build:** opening a Mix shows the editor (name, source card, graph, RULES, OPTIONS, bottom bar) with the cover graph built on-device by the Kotlin engine from `GET /state`, virtualised by row.

**Blocked by:** 02, 05

**Status:** ready-for-agent

**Glossary:** Original song, Rule copy, Preview. **Design:** interaction-spec §1, §7, §8; android-notes "Cover graph".

**Files:** `ui/editor/MixEditorScreen.kt`, `ui/graph/GraphLayout.kt` (`fun graphLayout(count: Int, cols: Int): List<GraphPos>`, same maths as web `layout`), `ui/graph/CoverGraph.kt` (`LazyColumn` of rows, odd rows reversed, wire in `drawBehind`), `ui/graph/Cover.kt` (Coil `AsyncImage` + CircleShape, ring border, split `drawArc`, stack rings, `x{N}`, `#n` chip, slot label, contentDescription per §8).

**Acceptance criteria**
- [ ] `GraphLayoutTest` matches the web layout test vectors.
- [ ] Compose tests: ring/chip/contentDescription per node kind; 600 nodes compose only visible rows.
- [ ] Offline: graph from cache, editing controls disabled.
