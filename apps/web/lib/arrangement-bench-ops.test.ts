import { build } from "@rulemix/rules-engine";
import { describe, expect, it } from "vitest";
import {
  benchOriginal,
  deleteCopy,
  deleteRepeatPlay,
  restoreFromBench,
  type ArrangementDraft,
} from "./arrangement-ops";

const A = (over: Partial<ArrangementDraft> = {}): ArrangementDraft => ({
  manualOrder: null,
  bench: [],
  rules: [
    { id: "x", removedPlays: 0, deletedCopies: [] },
    { id: "y", removedPlays: 0, deletedCopies: [2] },
  ],
  ...over,
});

describe("bench ops", () => {
  it("benchOriginal appends in benching order and drops it from a Manual order", () => {
    const a = benchOriginal(A(), "b");
    expect(a.bench).toEqual(["b"]);
    expect(a.manualOrder).toBeNull();
    const m = benchOriginal(A({ manualOrder: ["c", "b", "a"], bench: ["z"] }), "b");
    expect(m).toMatchObject({ bench: ["z", "b"], manualOrder: ["c", "a"] });
    expect(benchOriginal(m, "b")).toBe(m);
  });

  it("deleteCopy records the copy index once, sorted, on that rule only", () => {
    const a = deleteCopy(deleteCopy(A(), "y", 0), "y", 0);
    expect(a.rules).toEqual([
      { id: "x", removedPlays: 0, deletedCopies: [] },
      { id: "y", removedPlays: 0, deletedCopies: [0, 2] },
    ]);
  });

  it("deleteRepeatPlay counts down; at 1 play the stack is a plain Original", () => {
    const a = deleteRepeatPlay(A(), "x");
    expect(a.rules[0]).toEqual({ id: "x", removedPlays: 1, deletedCopies: [] });
    const r = build({
      source: [
        { uri: "spotify:track:a", name: "A", artists: [] },
        { uri: "spotify:track:b", name: "B", artists: [] },
      ],
      rules: [
        {
          id: "x",
          kind: "repeat",
          n: 2,
          uri: "spotify:track:a",
          removedPlays: 1,
          deletedCopies: [],
        },
      ],
      keepSourceOrder: true,
      seed: 1,
      manualOrder: null,
      bench: [],
    });
    expect(r.nodes.find((n) => n.uri === "spotify:track:a")).toMatchObject({
      role: "original",
      plays: 1,
    });
  });

  it("restoreFromBench inserts at start, middle and end and sets a Manual order", () => {
    const a = A({ bench: ["q", "z"] });
    const line = ["a", "b", "c"];
    expect(restoreFromBench(a, "q", 0, line)).toMatchObject({
      bench: ["z"],
      manualOrder: ["q", "a", "b", "c"],
    });
    expect(restoreFromBench(a, "q", 2, line).manualOrder).toEqual(["a", "b", "q", "c"]);
    expect(restoreFromBench(a, "q", 99, line).manualOrder).toEqual(["a", "b", "c", "q"]);
  });
});
