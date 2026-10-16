# Rules engine fixtures

Shared, language-neutral test cases for `build()` (ADR-0002). The TypeScript engine runs them in
`src/build.fixtures.test.ts`; the Kotlin port (`apps/android/engine`) must pass the same files unchanged (ADR-0031).

Each `NN-slug.json` file is one case:

```json
{ "name": "human description", "input": BuildInput, "expected": BuildResult }
```

- `input` / `expected` follow the types in `src/types.ts` exactly (camelCase keys, `null` for
  absent values). `source` items are `{ uri, name, artists }` or `null` (Unavailable track).
- v2 shape: `input` carries `manualOrder`, `bench`, and each rule has `id`, `removedPlays`, `deletedCopies`.
- Comparison is deep equality of the whole `BuildResult` (`uris`, `nodes`, `issues`, `stats`).
- Track URIs are `spotify:track:T01`…`spotify:track:T20`; other prefixes (`spotify:local:`,
  `spotify:episode:`) count as unavailable.
- `expected` values were worked out by hand from the algorithm in docs/spec-v2.md "Engine v2". For v2 the
  files were generated once from the engine and each expected graph was then checked by hand
  against the spec steps. When adding a case, check it by hand.

`prng.json` holds mulberry32 vectors (first 10 floats) and `seededShuffle` outputs for seeds 0, 1,
42 and 4294967295; `src/prng.fixtures.test.ts` runs them.
