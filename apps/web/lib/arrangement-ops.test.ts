import type { GraphNode } from "@rulemix/rules-engine";
import { describe, expect, it } from "vitest";
import { lineOf, moveOriginal, pickDropTarget } from "./arrangement-ops";

const node = (key: string, role: GraphNode["role"] = "original"): GraphNode => ({
  key,
  role,
  uri: key.replace(/^b:|^r:.*$/, "") || "x",
  plays: 1,
  ruleIndex: null,
  ruleIndices: [],
  shiftedFrom: null,
  copyIndex: null,
  firstSlot: 0,
});

describe("moveOriginal", () => {
  it("moves forward and backward to the target's position", () => {
    expect(moveOriginal(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveOriginal(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveOriginal(["a", "b", "c", "d"], "b", "b")).toEqual(["a", "b", "c", "d"]);
    expect(moveOriginal(["a", "b"], "z", "b")).toEqual(["a", "b"]);
  });
});

describe("lineOf / pickDropTarget", () => {
  const nodes = [node("r:p:0", "copy"), node("b:a"), node("b:b"), node("b:c")];
  const pos = (i: number) => ({ x: i * 72 + 36, y: 46 });
  it("lineOf lists Originals only", () => {
    expect(lineOf(nodes)).toEqual(["a", "b", "c"]);
  });
  it("picks the nearest Original within 70 px, never a rule copy or the dragged node", () => {
    expect(pickDropTarget(nodes, pos, 40, 46, "b:c")).toBe(1); // copy at 0 is skipped
    expect(pickDropTarget(nodes, pos, 150, 46, "b:b")).toBe(1);
    expect(pickDropTarget(nodes, pos, 1000, 46, "b:a")).toBe(-1);
  });
});
