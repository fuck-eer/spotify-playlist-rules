import type { GraphNode } from "@rulemix/rules-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Cover } from "./cover";
import { CoverGraph } from "./cover-graph";
import type { RuleMeta, TrackMeta } from "./labels";

afterEach(cleanup);

const T = (s: string) => `spotify:track:${s}`;
const node = (over: Partial<GraphNode>): GraphNode => ({
  key: `b:${T("a")}`,
  role: "original",
  uri: T("a"),
  plays: 1,
  ruleIndex: null,
  ruleIndices: [],
  shiftedFrom: null,
  copyIndex: null,
  firstSlot: 0,
  ...over,
});
const tracks: Record<string, TrackMeta> = {
  [T("a")]: { name: "Mr. Brightside", artists: ["The Killers"], imageUrl: null },
};
const rules: RuleMeta[] = [
  { kind: "pin_first", n: null },
  { kind: "every_n", n: 4 },
  { kind: "repeat", n: 3 },
];
const one = (n: GraphNode) => {
  render(<Cover node={n} track={tracks[n.uri]} rules={rules} />);
  return screen.getByTestId("cover");
};

describe("Cover", () => {
  it("plain Original: grey ring, no chip, slot label", () => {
    const c = one(node({ firstSlot: 6 }));
    expect(c.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Slot 7, Mr. Brightside by The Killers",
    );
    expect(c.querySelector("[data-ring]")!.getAttribute("data-ring")).toBe("plain");
    expect(c.textContent).toBe("7");
  });

  it("Rule copy: rule ring, #n chip and aria-label with the rule", () => {
    const c = one(
      node({
        key: "r:x:1",
        role: "copy",
        ruleIndex: 1,
        ruleIndices: [1],
        copyIndex: 1,
        firstSlot: 6,
      }),
    );
    expect(c.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Slot 7, Mr. Brightside by The Killers, rule #2 After every 4",
    );
    expect(c.querySelector("[data-ring]")!.getAttribute("data-ring")).toBe("rule");
    expect(c.textContent).toContain("#2");
  });

  it("Repeat stack: x3 label and range 5-7", () => {
    const c = one(node({ plays: 3, ruleIndex: 2, ruleIndices: [2], firstSlot: 4 }));
    expect(c.textContent).toContain("x3");
    expect(c.textContent).toContain("5-7");
    expect(c.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Slot 5-7, Mr. Brightside by The Killers, rule #3 Repeat x3",
    );
  });

  it("merged slot: split ring; shifted copy: moved from #p", () => {
    const c = one(
      node({
        key: "r:x:1",
        role: "copy",
        ruleIndex: 0,
        ruleIndices: [0, 1],
        copyIndex: 1,
        shiftedFrom: 0,
      }),
    );
    expect(c.querySelector("[data-ring]")!.getAttribute("data-ring")).toBe("split");
    expect(c.textContent).toContain("moved from #1");
    expect(c.querySelector("button")!.getAttribute("aria-label")).toContain(
      "rule #1 and #2 Start with and After every 4",
    );
  });
});

describe("CoverGraph", () => {
  it("renders only the rows near the viewport for 600 nodes", () => {
    const nodes = Array.from({ length: 600 }, (_, i) =>
      node({ key: `b:${T(String(i))}`, uri: T(String(i)), firstSlot: i }),
    );
    render(<CoverGraph nodes={nodes} tracks={{}} rules={[]} />);
    const n = screen.getAllByTestId("cover").length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(60);
  });
});
