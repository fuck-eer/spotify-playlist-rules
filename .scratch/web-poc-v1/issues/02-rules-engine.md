# 02: Rules engine: build() with all v1 rules, shared fixtures

**Status:** done
**Type:** task
**Blocked by:** 01
**Glossary terms:** Rule, Mix, Rule Set, Base list, Source playlist, Pin first, Insert every N, Repeat N times, Seed, Preview, Unavailable track
**Refs:** spec "Rule engine interface" + Confirmed decisions A1, A2, A10; ADR-0003, 0004, 0005, 0006, 0007, 0010, 0011

## What to build
A pure, deterministic function that turns source items plus an ordered Rule Set plus a Seed into the final track list and the Preview data. It is verifiable entirely by tests and JSON fixtures, which the future Kotlin port must also pass.

## Files
- `packages/rules-engine/src/types.ts`
- `packages/rules-engine/src/prng.ts`: `mulberry32` and `seededShuffle`
- `packages/rules-engine/src/build.ts`
- `packages/rules-engine/src/describe.ts`: user-facing copy for rules
- `packages/rules-engine/src/index.ts`: re-export everything public (remove `ENGINE_VERSION`, and remove its test)
- `packages/rules-engine/fixtures/*.json` plus `packages/rules-engine/fixtures/README.md` describing the format
- tests: `src/prng.test.ts`, `src/build.test.ts`, `src/build.fixtures.test.ts`, `src/build.property.test.ts`, `src/describe.test.ts`

## Exported interface (exact)
```ts
export type RuleKind = "pin_first" | "every_n" | "repeat";
export interface MixRuleInput { kind: RuleKind; uri: string; n: number | null } // n null for pin_first; 2..10 otherwise
export type SourceItem = { uri: string; name: string; artists: string[] } | null; // null = Unavailable track
export interface BuildInput {
  source: SourceItem[];          // Source playlist items in Spotify order (may contain null)
  rules: MixRuleInput[];         // Rule Set, index 0 = highest priority
  keepSourceOrder: boolean;      // false = seeded shuffle (ADR-0004)
  seed: number;                  // uint32
}
export interface PreviewSlot { uri: string; ruleIndex: number | null; shiftedFrom: number | null } // positions 0-based
export type BuildIssue =
  | { kind: "unavailable_rule_song"; ruleIndex: number };
export interface BuildStats { total: number; rulesApplied: number; skippedUnavailable: number }
export interface BuildResult { uris: string[]; preview: PreviewSlot[]; issues: BuildIssue[]; stats: BuildStats }
export function build(input: BuildInput): BuildResult;
export function mulberry32(seed: number): () => number;
export function seededShuffle<T>(items: readonly T[], seed: number): T[];
export const MIN_N = 2; export const MAX_N = 10;
export function ruleSentence(kind: RuleKind, n: number | null): string;
export function ruleCaption(kind: RuleKind, n: number | null): string;
export function mixRuleCardLine(kind: RuleKind, n: number | null, songName: string): string;
```

## Algorithm (exact; no deviations)
1. **Available items:** drop `null` items and items whose `uri` doesn't start with `spotify:track:`. `skippedUnavailable` = the number dropped. Keep duplicates.
2. **Ordered list:** if `keepSourceOrder`, keep it as is; otherwise apply `seededShuffle(available, seed)`.
   - `mulberry32` is the standard algorithm: `a|=0; a=a+0x6D2B79F5|0; t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296`.
   - `seededShuffle` copies the array, then Fisher–Yates from the end: `for i=len-1..1: j=Math.floor(rand()*(i+1)); swap(i,j)`.
3. **Active rules:** a rule whose `uri` is not in the available list produces the issue `unavailable_rule_song` and places nothing (A2). It is excluded from the steps below but keeps its `ruleIndex` numbering.
4. **Base list** = the ordered list with every occurrence of every active rule's uri removed (ADR-0005). `B` = its length.
5. **Counts:** `pin_first` = 1; `every_n` = `Math.floor(B / n)`; `repeat` = `n`. `L = B + sum(counts)`.
6. **Desired positions:**
   - `pin_first` → `[0]`.
   - `every_n` → `k*(n+1)-1` for `k = 1..floor(B/n)` (ADR-0007).
   - `repeat` → `start..start+n-1`, where `start = min(firstIndexOf(uri in ordered list from step 2), L - n)` (A1, ADR-0003).
7. **Claim slots:** go through the active rules in index order, and through each rule's desired positions in ascending order.
   - If the slot is free, take it with `shiftedFrom: null`.
   - Otherwise search forward `p+1..L-1` for the first free slot, then backward `p-1..0` (A10). Take it and set `shiftedFrom = p` (ADR-0006).
8. **Fill:** put the Base list into the remaining slots in order (`ruleIndex: null`, `shiftedFrom: null`).
9. **Output:**
   - `uris` = the slot uris;
   - `stats.total = L`;
   - `stats.rulesApplied` = the number of active rules with count > 0;
   - `issues` in rule order.
10. **Argument checks:** throw `RangeError` if `n` is out of `[MIN_N, MAX_N]` for `every_n`/`repeat`, if `n` isn't null for `pin_first`, or if `seed` isn't an integer in `[0, 2^32)`.

## Copy (from the mockup's sentence/caption/cardLine; N = n)
- `ruleSentence`:
  - pin_first → `Play a song first`
  - repeat → `Play a song N times in a row`
  - every_n → `Play a song after every N songs`
- `ruleCaption`:
  - pin_first → `#01 · this song leads the mix`
  - repeat → `N× · same song, in a row`
  - every_n → `every N · lands after each N songs`
- `mixRuleCardLine`:
  - pin_first → `Pin first · {song}`
  - repeat → `Repeat · {song} · N×`
  - every_n → `Every N · {song}`

## Fixtures (JSON, shared with the future Kotlin port; ADR-0002)
Each file looks like `{ "name": string, "input": BuildInput, "expected": BuildResult }`. Create these 12 files. Compute the `expected` values by hand from the algorithm and double-check them, rather than generating them from the code under test:
`01-empty.json`, `02-no-rules-keep-order.json`, `03-no-rules-shuffle-seed-42.json`, `04-pin-first.json`, `05-every-n-3-of-9.json`, `06-repeat-3.json`, `07-collision-removed.json`, `08-pin-vs-repeat-shift.json`, `09-two-every-n-conflict.json`, `10-unavailable-source-items.json`, `11-unavailable-rule-song.json`, `12-repeat-clamped-at-end.json`.

Use URIs of the form `spotify:track:T01`…`spotify:track:T20` in fixtures (any string with that prefix is valid).

## Tests (TDD, in this order)
1. `prng.test.ts`:
   - `mulberry32(42)` yields the same first 3 values on repeated calls. Hard-code the values once computed from the formula above.
   - `seededShuffle` is a permutation, is deterministic per seed, differs for seeds 1 and 2 on a 10-item list, and does not mutate its input.
2. `build.test.ts`: one `it` per algorithm step (1–10 above), including:
   - the shift-backward case: the last slot is taken and no free slot exists ahead;
   - `RangeError` cases.
3. `build.fixtures.test.ts`: loads every `fixtures/*.json` and checks `deepEqual(build(input), expected)`.
4. `build.property.test.ts` (fast-check, 200 runs each; source size 0–600 with nulls and duplicates; 0–10 rules with uris drawn from the source; n in 2..10):
   - `uris.length === stats.total`;
   - the multiset of base uris (available, minus rule uris) is preserved exactly once;
   - each active rule's uri count equals its count;
   - determinism: the same input gives a deep-equal output;
   - every slot with `shiftedFrom !== null` has `ruleIndex !== null`;
   - with no conflicts (a single rule), `shiftedFrom` is always null;
   - `skippedUnavailable` equals the number of nulls plus invalid uris.
5. `describe.test.ts`: exact strings for every kind, using n=4.

## Acceptance criteria
- [x] The interface above is exported exactly from `@rulemix/rules-engine`
- [x] All tests pass; typecheck and lint pass
- [x] No imports of Node or browser APIs in `src/` (pure)
- [x] 12 fixture files plus a README
