# 01: Engine v2 (rules add copies, Manual order, Bench, deleted copies) + shared fixtures

**What to build:** `build()` in packages/rules-engine produces the v2 graph exactly as docs/spec-v2.md "Engine v2" (steps 1–7, `GraphNode`, issues, stats). This is the contract both web and Android use.

**Blocked by:** None (can start immediately)

**Status:** done

**Glossary:** Original song, Rule copy, Manual order, Bench, Source sync, Seed, Insert every N, Pin first (Start with), Repeat N times.
**ADRs:** 0019, 0020, 0027, 0028, 0029, 0030, 0031.

**Files**
- `packages/rules-engine/src/types.ts`: `MixRuleInput { id: string; kind: RuleKind; uri: string; n: number | null; removedPlays: number; deletedCopies: number[] }`; `BuildInput { source; rules; keepSourceOrder; seed; manualOrder: string[] | null; bench: string[] }`; `GraphNode` (spec shape); `BuildIssue = { kind: "rule_song_not_in_source"; ruleIndex: number }`; `BuildStats { total; rulesApplied; skippedUnavailable; benched }`; `BuildResult { uris: string[]; nodes: GraphNode[]; issues; stats }`. Remove `PreviewSlot`.
- `packages/rules-engine/src/build.ts`: v2 algorithm. Validation adds: `removedPlays` integer ≥ 0 and `< n` for repeat, 0 otherwise; `deletedCopies` integers ≥ 0; rule ids unique.
- `packages/rules-engine/src/describe.ts`: unchanged behaviour; update types if needed.
- `packages/rules-engine/fixtures/*.json`: rewrite all 14 for v2 (expected worked out by hand, per fixtures/README.md); add 15–24: manual order; manual order + new Source songs appended; bench removes Original but keeps its Start with copy; benched URI missing from Source ignored; deleted every-N copy (later nodes move up); Repeat x3 with removedPlays 1 → plays 2; Repeat with removedPlays n-1 → plain node; Start with on song not in Source (copy placed + issue); duplicates in Source collapse; merged every-N with deleted copy.
- `packages/rules-engine/fixtures/prng.json`: `{ mulberry32: [{ seed, first: number[10] }], shuffle: [{ seed, input: string[], output: string[] }] }` for seeds 0, 1, 42, 4294967295; `src/prng.fixtures.test.ts` runs it.
- `packages/rules-engine/fixtures/README.md`: document v2 shape and prng.json.
- Update `src/build.test.ts`, `src/build.property.test.ts`, `src/build.fixtures.test.ts` (count 24).

**Acceptance criteria**
- [ ] All fixtures and prng vectors pass; property tests: `uris.length === sum(nodes.plays)`, no benched URI in `uris` as an Original node, no node whose key matches a deleted copy, determinism.
- [ ] `pnpm -F @rulemix/rules-engine test typecheck lint` green.
- [ ] apps/web compiles against the new types with a temporary adapter in `lib/preview.ts` mapping `nodes` to the old dot line (removed in 04), passing `manualOrder: null, bench: []`, `removedPlays: 0, deletedCopies: []` and `id` = mix rule id.
