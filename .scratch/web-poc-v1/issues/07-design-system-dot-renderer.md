# 07: Design system, 10-colour rule palette, SVG dot renderer

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Glossary terms:** Rule, Mix, Preview, Pin first, Insert every N, Repeat N times
**Refs:** ADR-0017 (10 colours, colour by position), ADR-0012 (shift badge), ADR-0003; design doc "Decisions"; mockup `docs/design/DSN-20261016-playlist-rules/index.html` (CSS vars `--r1..--r5`, dot SVG), `editor.png`, `desktop.png`, `motion/editor-motion.mp4`, `motion/builder-motion.mp4`

## What to build
The shared visual building blocks, shown on a dev-only page `/dev/components`, so they can be checked against the mockup before any data exists.

## Rule palette (exact; colour = position in the Rule Set, index 0 → R1)
R1–R5 come from the mockup. R6–R10 are new: muted pastels at a similar lightness and saturation, chosen to be distinguishable from R1–R5 and from the green `#1DB954` and the error red `#f15e6c`.

| # | hex | name |
|---|---|---|
| 1 | `#e8b04b` | amber (mockup --r1) |
| 2 | `#7aa7ff` | blue (mockup --r2) |
| 3 | `#e57a9a` | rose (mockup --r3) |
| 4 | `#9ad08a` | sage (mockup --r4) |
| 5 | `#c9a3f0` | lilac (mockup --r5) |
| 6 | `#5fcfc4` | teal |
| 7 | `#f0895a` | coral |
| 8 | `#d8d36a` | citron |
| 9 | `#8f96f0` | periwinkle |
| 10 | `#c8b08a` | sand |

The neutral dot (library, pickers, base songs) is `#555555`. The editor draft dot is `#ffffff`.

## Files
- `apps/web/lib/palette.ts`:
  - `export const RULE_COLORS = [ ...10 hex strings above ] as const;`
  - `export const NEUTRAL_DOT = "#555555";`
  - `export const DRAFT_DOT = "#ffffff";`
  - `export function ruleColor(index: number): string`, which throws `RangeError` outside 0–9.
- `apps/web/app/globals.css`: add `--color-r1` … `--color-r10` to `@theme`.
- `apps/web/components/dots/dot-line.tsx`:
  ```ts
  export interface DotItem { key: string; color: string; label?: string /* tiny mono "#n" */; loop?: number /* repeat count >1 => self-loop + "N×" */; badge?: string /* e.g. "moved from #4" */ }
  export interface DotLineProps { items: DotItem[]; maxDots?: number /* default 22 */; totalCount?: number; ariaLabel: string }
  export function DotLine(props: DotLineProps): JSX.Element;
  ```
  - Renders an SVG of dots (radius 7, spacing 22) joined by a 2px line in `--color-line`, wrapping to rows by container width (use `ResizeObserver`).
  - A dot with `loop` draws a self-loop arrow above it with the text `{loop}×` in mono 10px.
  - A `label` renders under the dot in mono 9px.
  - A `badge` renders a small pill above the dot in mono 9px on `--color-s3`, and is also put into the dot's `<title>`.
  - When `items.length > maxDots`, the component shows `maxDots` dots and then a mono `+{n} more` text, which fixes the mockup's missing "more" indicator.
  - Motion follows the mockup's Motion section:
    - first draw staggers 16ms per dot;
    - on reflow, kept dots move first (stagger capped at 90ms) and new dots drop in after 80ms;
    - uses Framer Motion `layout`;
    - all motion is disabled under `prefers-reduced-motion` (`useReducedMotion`).
- `apps/web/components/dots/rule-intent-graphic.tsx`:
  - `export function RuleIntentGraphic(props: { kind: RuleKind; n: number | null; color?: string }): JSX.Element`.
  - It draws an illustrative 12-dot row:
    - pin_first: dot 0 coloured;
    - every_n: a coloured dot after every n neutral dots;
    - repeat: one coloured dot at index 3 with `loop = n`.
  - Default colour is `DRAFT_DOT`. It reuses `DotLine`, so a single renderer serves both the editor and the Preview.
- `apps/web/components/dots/collapse-preview.ts`:
  - `export function previewToDots(preview: PreviewSlot[], names: Record<string,string>): DotItem[]`.
  - Consecutive slots with the same `ruleIndex !== null` and the same uri, where the rule kind is repeat, collapse into one dot with `loop = run length`. To do that, the function takes `kinds: RuleKind[]` as a third parameter: `previewToDots(preview, names, kinds)`.
  - Colour = `ruleColor(ruleIndex)` or `NEUTRAL_DOT`.
  - `label` = `#${ruleIndex+1}` for rule dots.
  - `badge` = `moved from #${shiftedFrom+1}` when `shiftedFrom !== null`, using 1-based display (ADR-0006).
  - `key` = `${slotIndex}`.
- `apps/web/app/dev/components/page.tsx`: renders the palette swatches, a DotLine with 30 items (some looped, some badged), and a RuleIntentGraphic for each kind at n=4. It returns `notFound()` when `NODE_ENV === "production"`.
- shadcn components to add now (used by later tickets): `sheet`, `dialog`, `alert-dialog`, `tabs`, `dropdown-menu`, `input`, `switch`, `sonner` (toasts), `skeleton`, `progress`.

## Tests (write first)
- `palette.test.ts`:
  - exactly 10 unique colours;
  - the first 5 equal the mockup values;
  - `ruleColor(10)` throws.
- `collapse-preview.test.ts`:
  - a repeat run of 3 → one dot with `loop: 3`;
  - two adjacent pin/every dots don't collapse;
  - the shifted badge text is "moved from #5" for `shiftedFrom: 4`;
  - base slots get the neutral colour and no label.
- `dot-line.test.tsx`:
  - 30 items with `maxDots` 22 render 22 circles and the text "+8 more";
  - a loop item renders the text "3×";
  - the badge text is present;
  - it has the `aria-label`.
- `rule-intent-graphic.test.tsx`: every_n with n=4 gives coloured dots at indices 4 and 9; pin gives a coloured dot at index 0.

## Acceptance criteria
- [ ] `/dev/components` visually matches the dot style in the mockup's `editor.png` (manual check)
- [ ] The palette is defined once (TS + CSS) with the exact hex values above
- [ ] Reduced motion disables animation
