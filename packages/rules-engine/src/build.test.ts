import { describe, expect, it } from "vitest";
import { build } from "./build.js";
import type { BuildInput, MixRuleInput, SourceItem } from "./types.js";

const t = (id: string): string => `spotify:track:${id}`;
const item = (id: string): SourceItem => ({ uri: t(id), name: id, artists: ["Artist"] });
const src = (...ids: (string | null)[]): SourceItem[] =>
  ids.map((id) => (id === null ? null : item(id)));
const input = (
  source: SourceItem[],
  rules: MixRuleInput[] = [],
  over: Partial<BuildInput> = {},
): BuildInput => ({
  source,
  rules,
  keepSourceOrder: true,
  seed: 0,
  ...over,
});
const base = (uri: string) => ({ uri, ruleIndex: null, shiftedFrom: null });

describe("build", () => {
  it("step 1: drops null and non-track items, counts them, keeps duplicates", () => {
    const source: SourceItem[] = [
      item("A"),
      null,
      { uri: "spotify:local:x", name: "x", artists: [] },
      item("A"),
    ];
    const r = build(input(source));
    expect(r.uris).toEqual([t("A"), t("A")]);
    expect(r.stats.skippedUnavailable).toBe(2);
  });

  it("step 2: keeps source order, or applies the seeded shuffle", () => {
    const source = src("01", "02", "03", "04", "05");
    expect(build(input(source)).uris).toEqual(["01", "02", "03", "04", "05"].map(t));
    // Worked by hand from mulberry32(42): j = 3, 1, 2, 1.
    expect(build(input(source, [], { keepSourceOrder: false, seed: 42 })).uris).toEqual(
      ["01", "05", "03", "02", "04"].map(t),
    );
  });

  it("step 3: a rule whose song is not available reports an issue and keeps index numbering", () => {
    const r = build(
      input(src("A", "B", "C"), [
        { kind: "pin_first", uri: t("Z"), n: null },
        { kind: "pin_first", uri: t("C"), n: null },
      ]),
    );
    expect(r.issues).toEqual([{ kind: "unavailable_rule_song", ruleIndex: 0 }]);
    expect(r.preview).toEqual([
      { uri: t("C"), ruleIndex: 1, shiftedFrom: null },
      base(t("A")),
      base(t("B")),
    ]);
  });

  it("step 4: removes every occurrence of an active rule's song from the Base list", () => {
    const r = build(input(src("A", "B", "C", "A"), [{ kind: "pin_first", uri: t("A"), n: null }]));
    expect(r.uris).toEqual([t("A"), t("B"), t("C")]);
  });

  it("step 5: every_n contributes floor(B / n) copies", () => {
    const r = build(
      input(src("1", "2", "3", "4", "5", "X"), [{ kind: "every_n", uri: t("X"), n: 2 }]),
    );
    expect(r.stats.total).toBe(7);
  });

  it("step 6: every_n lands at k*(n+1)-1", () => {
    const r = build(input(src("1", "2", "3", "4", "X"), [{ kind: "every_n", uri: t("X"), n: 2 }]));
    expect(r.uris).toEqual(["1", "2", "X", "3", "4", "X"].map(t));
  });

  it("step 6: repeat starts at the song's first index in the ordered list", () => {
    const r = build(input(src("A", "B", "C", "D"), [{ kind: "repeat", uri: t("B"), n: 2 }]));
    expect(r.uris).toEqual(["A", "B", "B", "C", "D"].map(t));
  });

  it("step 6: repeat start is clamped to L - n", () => {
    const r = build(
      input(src("A", "B", "X", "C"), [
        { kind: "repeat", uri: t("C"), n: 3 },
        { kind: "every_n", uri: t("X"), n: 10 },
      ]),
    );
    expect(r.uris).toEqual(["A", "B", "C", "C", "C"].map(t));
  });

  it("step 7: a taken slot shifts the lower rule forward", () => {
    const r = build(
      input(src("B", "A", "C"), [
        { kind: "pin_first", uri: t("A"), n: null },
        { kind: "repeat", uri: t("B"), n: 2 },
      ]),
    );
    expect(r.preview).toEqual([
      { uri: t("A"), ruleIndex: 0, shiftedFrom: null },
      { uri: t("B"), ruleIndex: 1, shiftedFrom: 0 },
      { uri: t("B"), ruleIndex: 1, shiftedFrom: 1 },
      base(t("C")),
    ]);
  });

  it("step 7: shifts backward when no free slot exists ahead", () => {
    const r = build(
      input(src("A", "B", "X", "Y"), [
        { kind: "every_n", uri: t("X"), n: 10 },
        { kind: "repeat", uri: t("Y"), n: 2 },
        { kind: "repeat", uri: t("Y"), n: 2 },
      ]),
    );
    expect(r.preview).toEqual([
      base(t("A")),
      base(t("B")),
      { uri: t("Y"), ruleIndex: 2, shiftedFrom: 4 },
      { uri: t("Y"), ruleIndex: 1, shiftedFrom: null },
      { uri: t("Y"), ruleIndex: 1, shiftedFrom: null },
      { uri: t("Y"), ruleIndex: 2, shiftedFrom: 3 },
    ]);
  });

  it("step 8: fills remaining slots with the Base list in order", () => {
    const r = build(input(src("A", "B", "C"), [{ kind: "pin_first", uri: t("C"), n: null }]));
    expect(r.preview.slice(1)).toEqual([base(t("A")), base(t("B"))]);
  });

  it("step 9: reports stats, counting only active rules with a non-zero count", () => {
    const r = build(
      input(src("A", "B", "X", "Y", null), [
        { kind: "every_n", uri: t("X"), n: 10 },
        { kind: "repeat", uri: t("Y"), n: 2 },
        { kind: "pin_first", uri: t("Q"), n: null },
      ]),
    );
    expect(r.stats).toEqual({ total: 4, rulesApplied: 1, skippedUnavailable: 1 });
    expect(r.issues).toEqual([{ kind: "unavailable_rule_song", ruleIndex: 2 }]);
  });

  it("step 10: throws RangeError on invalid arguments", () => {
    const s = src("A");
    expect(() => build(input(s, [{ kind: "every_n", uri: t("A"), n: 1 }]))).toThrow(RangeError);
    expect(() => build(input(s, [{ kind: "repeat", uri: t("A"), n: 11 }]))).toThrow(RangeError);
    expect(() => build(input(s, [{ kind: "repeat", uri: t("A"), n: null }]))).toThrow(RangeError);
    expect(() => build(input(s, [{ kind: "every_n", uri: t("A"), n: 2.5 }]))).toThrow(RangeError);
    expect(() => build(input(s, [{ kind: "pin_first", uri: t("A"), n: 2 }]))).toThrow(RangeError);
    expect(() => build(input(s, [], { seed: -1 }))).toThrow(RangeError);
    expect(() => build(input(s, [], { seed: 1.5 }))).toThrow(RangeError);
    expect(() => build(input(s, [], { seed: 2 ** 32 }))).toThrow(RangeError);
  });
});
