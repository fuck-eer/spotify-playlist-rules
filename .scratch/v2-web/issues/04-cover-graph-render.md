# 04: Cover graph (read-only render) replaces the dot line

**What to build:** opening a Mix shows the cover graph built in the browser from `GET /state`: boustrophedon line, rings, `#n` chips, stacks `xN` with slot range, split rings and `moved from #p`, slot numbers, summary, art with gradient fallback, virtualised rows.

**Blocked by:** 02

**Status:** ready-for-agent

**Glossary:** Original song, Rule copy, Preview, Unavailable track. **Design:** interaction-spec §1, §7, §8; `tokens.json`; shots `desktop.png`, `mobile.png`.

**Files**
- `apps/web/components/graph/layout.ts`: `layout(count: number, width: number): { cols: number; pos(i: number): { x: number; y: number; row: number } ; height: number }` (72 px column, 92 px row, min 3 cols, odd rows right-to-left).
- `apps/web/components/graph/cover-graph.tsx`: `CoverGraph({ nodes, tracks, onTap?, … })`; wire per visible row (SVG path with U-turns); renders rows in viewport ± 2.
- `apps/web/components/graph/cover.tsx`: ring (grey `#555`, rule palette, split halves), chip, stack, label, aria-label strings per §8.
- `apps/web/lib/use-mix-state.ts`: fetch state, run `build`, refetch on window focus.
- `apps/web/components/mix/mix-builder.tsx`: use the graph; remove the dot line and the 01 adapter (`components/dots/*` deleted when unused).

**Acceptance criteria**
- [ ] `layout.test.ts`: positions for n = 1, 3, 7, 20 at widths 300/1000; height.
- [ ] Component tests: ring/chip/aria-label per node kind; stack label `x3` and range `5-7`; summary text with and without `· your order`; only ~visible rows rendered for 600 nodes.
- [ ] Playwright: the QA Mix shows covers in play order matching `uris`.
