import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build } from "./build.js";
import type { BuildInput, MixRuleInput, SourceItem } from "./types.js";

const RUNS = { numRuns: 200 };

const itemArb: fc.Arbitrary<SourceItem> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc
      .integer({ min: 1, max: 40 })
      .map((i) => ({ uri: `spotify:track:T${i}`, name: `S${i}`, artists: ["A"] })),
  },
  { weight: 1, arbitrary: fc.constant(null) },
  {
    weight: 1,
    arbitrary: fc
      .integer({ min: 1, max: 5 })
      .map((i) => ({ uri: `spotify:local:L${i}`, name: "L", artists: [] })),
  },
);

const ruleArb = (uris: string[]): fc.Arbitrary<Omit<MixRuleInput, "id">> =>
  fc.oneof(
    fc.record({
      kind: fc.constant("pin_first" as const),
      uri: fc.constantFrom(...uris),
      n: fc.constant(null),
      removedPlays: fc.constant(0),
      deletedCopies: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 2 }),
    }),
    fc.record({
      kind: fc.constant("every_n" as const),
      uri: fc.constantFrom(...uris),
      n: fc.integer({ min: 2, max: 10 }),
      removedPlays: fc.constant(0),
      deletedCopies: fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 4 }),
    }),
    fc
      .tuple(fc.constantFrom(...uris), fc.integer({ min: 2, max: 10 }), fc.nat())
      .map(([uri, n, r]) => ({
        kind: "repeat" as const,
        uri,
        n,
        removedPlays: r % n,
        deletedCopies: [],
      })),
  );

const inputArb: fc.Arbitrary<BuildInput> = fc.array(itemArb, { maxLength: 600 }).chain((source) => {
  const uris = [
    ...new Set([...source.flatMap((s) => (s === null ? [] : [s.uri])), "spotify:track:GONE"]),
  ];
  return fc.record({
    source: fc.constant(source),
    rules: fc
      .array(ruleArb(uris), { maxLength: 10 })
      .map((rs) => rs.map((r, i) => ({ ...r, id: `m${i}` }))),
    keepSourceOrder: fc.boolean(),
    seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    manualOrder: fc.option(fc.shuffledSubarray(uris), { nil: null }),
    bench: fc.subarray(uris, { maxLength: Math.min(5, uris.length) }),
  });
});

describe("build properties", () => {
  it("uris.length = stats.total = sum of node plays; firstSlot is consistent", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const r = build(input);
        const sum = r.nodes.reduce((s, n) => s + n.plays, 0);
        expect(r.uris).toHaveLength(sum);
        expect(r.stats.total).toBe(sum);
        let slot = 0;
        for (const n of r.nodes) {
          expect(n.firstSlot).toBe(slot);
          slot += n.plays;
        }
      }),
      RUNS,
    );
  });

  it("no benched URI appears as an Original node", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const bench = new Set(input.bench);
        for (const n of build(input).nodes) {
          if (n.role === "original") expect(bench.has(n.uri)).toBe(false);
        }
      }),
      RUNS,
    );
  });

  it("no node matches a deleted copy", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const deleted = new Set(
          input.rules.flatMap((r) => r.deletedCopies.map((c) => `r:${r.id}:${c}`)),
        );
        for (const n of build(input).nodes) expect(deleted.has(n.key)).toBe(false);
      }),
      RUNS,
    );
  });

  it("every Original appears once and keys are unique", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const keys = build(input).nodes.map((n) => n.key);
        expect(new Set(keys).size).toBe(keys.length);
      }),
      RUNS,
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(build(input)).toEqual(build(structuredClone(input)));
      }),
      RUNS,
    );
  });
});
