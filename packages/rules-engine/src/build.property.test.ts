import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build } from "./build.js";
import type { BuildInput, MixRuleInput, SourceItem } from "./types.js";

const RUNS = { numRuns: 200 };

// Small id pool so duplicates are common; a few invalid uris and nulls.
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

const ruleArb = (uris: string[]): fc.Arbitrary<MixRuleInput> =>
  fc.oneof(
    fc.constantFrom(...uris).map((uri): MixRuleInput => ({ kind: "pin_first", uri, n: null })),
    fc
      .tuple(
        fc.constantFrom(...uris),
        fc.constantFrom("every_n" as const, "repeat" as const),
        fc.integer({ min: 2, max: 10 }),
      )
      .map(([uri, kind, n]): MixRuleInput => ({ kind, uri, n })),
  );

const inputArb = (maxRules: number): fc.Arbitrary<BuildInput> =>
  fc.array(itemArb, { minLength: 0, maxLength: 600 }).chain((source) => {
    const uris = source.flatMap((s) => (s === null ? [] : [s.uri]));
    const rules =
      uris.length === 0 ? fc.constant([]) : fc.array(ruleArb(uris), { maxLength: maxRules });
    return fc.record({
      source: fc.constant(source),
      rules,
      keepSourceOrder: fc.boolean(),
      seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    });
  });

const isTrack = (s: SourceItem): s is NonNullable<SourceItem> =>
  s !== null && s.uri.startsWith("spotify:track:");
const tally = (xs: string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

describe("build properties", () => {
  it("uris.length equals stats.total", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        const r = build(input);
        expect(r.uris).toHaveLength(r.stats.total);
        expect(r.preview).toHaveLength(r.stats.total);
      }),
      RUNS,
    );
  });

  it("preserves the base multiset exactly once", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        const r = build(input);
        const available = input.source.filter(isTrack).map((s) => s.uri);
        const ruleUris = new Set(
          input.rules.map((x) => x.uri).filter((u) => available.includes(u)),
        );
        const expected = tally(available.filter((u) => !ruleUris.has(u)));
        const actual = tally(r.preview.filter((s) => s.ruleIndex === null).map((s) => s.uri));
        expect(actual).toEqual(expected);
      }),
      RUNS,
    );
  });

  it("each active rule places exactly its count", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        const r = build(input);
        const available = input.source.filter(isTrack).map((s) => s.uri);
        const ruleUris = new Set(
          input.rules.map((x) => x.uri).filter((u) => available.includes(u)),
        );
        const b = available.filter((u) => !ruleUris.has(u)).length;
        input.rules.forEach((rule, i) => {
          const placed = r.preview.filter((s) => s.ruleIndex === i);
          const expected = !available.includes(rule.uri)
            ? 0
            : rule.kind === "pin_first"
              ? 1
              : rule.kind === "repeat"
                ? (rule.n ?? 0)
                : Math.floor(b / (rule.n ?? 1));
          expect(placed).toHaveLength(expected);
          expect(placed.every((s) => s.uri === rule.uri)).toBe(true);
        });
      }),
      RUNS,
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        expect(build(input)).toEqual(build(input));
      }),
      RUNS,
    );
  });

  it("only rule slots can be shifted", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        for (const s of build(input).preview)
          if (s.shiftedFrom !== null) expect(s.ruleIndex).not.toBeNull();
      }),
      RUNS,
    );
  });

  it("a single rule never shifts", () => {
    fc.assert(
      fc.property(inputArb(1), (input) => {
        expect(build(input).preview.every((s) => s.shiftedFrom === null)).toBe(true);
      }),
      RUNS,
    );
  });

  it("skippedUnavailable counts nulls and non-track uris", () => {
    fc.assert(
      fc.property(inputArb(10), (input) => {
        const expected = input.source.filter((s) => !isTrack(s)).length;
        expect(build(input).stats.skippedUnavailable).toBe(expected);
      }),
      RUNS,
    );
  });
});
