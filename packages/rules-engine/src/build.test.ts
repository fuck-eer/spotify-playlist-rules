import { describe, expect, it } from "vitest";
import { build } from "./build.js";
import type { BuildInput, MixRuleInput, RuleKind, SourceItem } from "./types.js";

const t = (id: string): string => `spotify:track:${id}`;
const item = (id: string): SourceItem => ({ uri: t(id), name: id, artists: ["Artist"] });
const src = (...ids: (string | null)[]): SourceItem[] =>
  ids.map((id) => (id === null ? null : item(id)));
const rule = (
  id: string,
  kind: RuleKind,
  song: string,
  n: number | null = null,
  over: Partial<MixRuleInput> = {},
): MixRuleInput => ({ id, kind, uri: t(song), n, removedPlays: 0, deletedCopies: [], ...over });
const input = (
  source: SourceItem[],
  rules: MixRuleInput[] = [],
  over: Partial<BuildInput> = {},
): BuildInput => ({
  source,
  rules,
  keepSourceOrder: true,
  seed: 0,
  manualOrder: null,
  bench: [],
  ...over,
});
const keys = (i: BuildInput) => build(i).nodes.map((n) => n.key);

describe("build v2", () => {
  it("drops unavailable items and collapses duplicates to one Original", () => {
    const r = build(
      input([
        item("A"),
        null,
        { uri: "spotify:local:x", name: "x", artists: [] },
        item("A"),
        item("B"),
      ]),
    );
    expect(r.uris).toEqual([t("A"), t("B")]);
    expect(r.stats.skippedUnavailable).toBe(2);
  });

  it("shuffles with the seed when no Manual order", () => {
    // Worked by hand from mulberry32(42): j = 3, 1, 2, 1.
    expect(
      build(input(src("01", "02", "03", "04", "05"), [], { keepSourceOrder: false, seed: 42 }))
        .uris,
    ).toEqual(["01", "05", "03", "02", "04"].map(t));
  });

  it("Start with adds a copy at slot 0 and the Original stays in place", () => {
    const r = build(input(src("A", "B", "C"), [rule("p", "pin_first", "C")]));
    expect(r.uris).toEqual(["C", "A", "B", "C"].map(t));
    expect(r.nodes[0]).toEqual({
      key: "r:p:0",
      role: "copy",
      uri: t("C"),
      plays: 1,
      ruleIndex: 0,
      ruleIndices: [0],
      shiftedFrom: null,
      copyIndex: 0,
      firstSlot: 0,
    });
    expect(r.nodes[3]?.key).toBe(`b:${t("C")}`);
  });

  it("every N inserts floor(B/n) copies at k*(n+1)-1", () => {
    // B=6, n=3: 2 copies at 3 and 7, L=8.
    expect(keys(input(src("A", "B", "C", "D", "E", "F"), [rule("e", "every_n", "A", 3)]))).toEqual([
      `b:${t("A")}`,
      `b:${t("B")}`,
      `b:${t("C")}`,
      "r:e:1",
      `b:${t("D")}`,
      `b:${t("E")}`,
      `b:${t("F")}`,
      "r:e:2",
    ]);
  });

  it("Repeat makes the Original a stack; removedPlays lowers it; at 1 it is plain", () => {
    const r = build(input(src("A", "B"), [rule("r", "repeat", "B", 3, { removedPlays: 1 })]));
    expect(r.uris).toEqual(["A", "B", "B"].map(t));
    expect(r.nodes[1]).toMatchObject({ plays: 2, ruleIndex: 0, ruleIndices: [0], firstSlot: 1 });
    const plain = build(input(src("A", "B"), [rule("r", "repeat", "B", 3, { removedPlays: 2 })]));
    expect(plain.nodes[1]).toMatchObject({ plays: 1, ruleIndex: null, ruleIndices: [] });
  });

  it("Manual order wins; new Source songs are appended; stale URIs ignored", () => {
    expect(
      build(input(src("A", "B", "C", "D"), [], { manualOrder: [t("C"), t("Z"), t("A")] })).uris,
    ).toEqual(["C", "A", "B", "D"].map(t));
  });

  it("Bench removes the Original but keeps its Start with copy", () => {
    const r = build(
      input(src("A", "B", "C"), [rule("p", "pin_first", "B")], { bench: [t("B"), t("Z")] }),
    );
    expect(r.uris).toEqual(["B", "A", "C"].map(t));
    expect(r.stats.benched).toBe(1);
    expect(r.issues).toEqual([]);
  });

  it("a Repeat on a benched song places nothing and reports an issue", () => {
    const r = build(input(src("A", "B"), [rule("r", "repeat", "B", 2)], { bench: [t("B")] }));
    expect(r.uris).toEqual([t("A")]);
    expect(r.issues).toEqual([{ kind: "rule_song_not_in_source", ruleIndex: 0 }]);
    expect(r.stats.rulesApplied).toBe(0);
  });

  it("Start with on a song not in the Source still places its copy", () => {
    const r = build(input(src("A", "B"), [rule("p", "pin_first", "Z")]));
    expect(r.uris).toEqual(["Z", "A", "B"].map(t));
    expect(r.issues).toEqual([{ kind: "rule_song_not_in_source", ruleIndex: 0 }]);
    expect(r.stats.rulesApplied).toBe(1);
  });

  it("a deleted copy is removed and later nodes move up", () => {
    const r = build(
      input(src("A", "B", "C", "D", "E", "F"), [
        rule("e", "every_n", "A", 3, { deletedCopies: [1] }),
      ]),
    );
    expect(r.uris).toEqual(["A", "B", "C", "D", "E", "F", "A"].map(t));
    expect(r.nodes.at(-1)).toMatchObject({ key: "r:e:2", firstSlot: 6 });
  });

  it("a collision shifts the lower-priority copy forward with shiftedFrom", () => {
    // B=3, pin Z + every 2 of A: L=5, every-N copy at 2. Pin at 0. No clash; use two pins.
    const r = build(
      input(src("A", "B"), [rule("p1", "pin_first", "A"), rule("p2", "pin_first", "B")]),
    );
    expect(r.nodes.map((n) => [n.key, n.shiftedFrom])).toEqual([
      ["r:p1:0", null],
      ["r:p2:0", 0],
      [`b:${t("A")}`, null],
      [`b:${t("B")}`, null],
    ]);
  });

  it("validates removedPlays, deletedCopies and unique ids", () => {
    expect(() =>
      build(input(src("A"), [rule("r", "repeat", "A", 2, { removedPlays: 2 })])),
    ).toThrow(RangeError);
    expect(() =>
      build(input(src("A"), [rule("p", "pin_first", "A", null, { removedPlays: 1 })])),
    ).toThrow(RangeError);
    expect(() =>
      build(input(src("A"), [rule("p", "pin_first", "A", null, { deletedCopies: [-1] })])),
    ).toThrow(RangeError);
    expect(() =>
      build(input(src("A"), [rule("x", "pin_first", "A"), rule("x", "pin_first", "A")])),
    ).toThrow(RangeError);
    expect(() => build(input(src("A"), [], { seed: -1 }))).toThrow(RangeError);
  });
});
