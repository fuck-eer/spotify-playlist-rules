import type { GraphNode } from "@rulemix/rules-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  popDelay,
  springLinear,
  springPop,
  springSheet,
  springSnap,
  wireDuration,
} from "@/lib/motion";
import { BenchCluster } from "./bench-cluster";
import { CoverGraph } from "./cover-graph";

const node = (i: number): GraphNode => ({
  key: `b:spotify:track:${i}`,
  role: "original",
  uri: `spotify:track:${i}`,
  plays: 1,
  ruleIndex: null,
  ruleIndices: [],
  shiftedFrom: null,
  copyIndex: null,
  firstSlot: i,
});

function mockReduced(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: reduce && q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("motion tokens", () => {
  it("match motion-spec.md", () => {
    expect(springSnap).toMatchObject({ stiffness: 600, damping: 40, mass: 1 });
    expect(springPop).toMatchObject({ stiffness: 800, damping: 40, mass: 1 });
    expect(springSheet).toMatchObject({ stiffness: 500, damping: 42, mass: 1 });
    expect(wireDuration(2)).toBeCloseTo(0.228);
    expect(wireDuration(100)).toBe(0.4);
    expect(popDelay(0, 10)).toBe(0);
    expect(popDelay(9, 10)).toBeCloseTo(wireDuration(10) - 0.12);
    const css = springLinear(800, 40, 288);
    expect(css.startsWith("linear(0.0000,")).toBe(true);
    expect(css.endsWith(", 1)")).toBe(true);
  });
});

const graph = () => render(<CoverGraph nodes={[0, 1, 2].map(node)} tracks={{}} rules={[]} />);

describe("reduced motion", () => {
  it("animates covers in normally (they start hidden)", () => {
    mockReduced(false);
    graph();
    const covers = screen.getAllByTestId("cover");
    expect(covers.some((c) => c.style.opacity === "0")).toBe(true);
  });

  it("prefers-reduced-motion: reduce renders the final state immediately", () => {
    mockReduced(true);
    graph();
    for (const c of screen.getAllByTestId("cover")) {
      expect(c.style.opacity).not.toBe("0");
      expect(c.style.transform).not.toMatch(/scale\(0\.5\)/);
    }
    expect(document.querySelector("path")?.getAttribute("pathLength") ?? null).not.toBe("0");
    render(
      <BenchCluster bench={["spotify:track:x"]} images={{}} open={false} onToggle={() => {}} />,
    );
    const cluster = screen.getByTestId("bench-cluster");
    expect(cluster.style.opacity).not.toBe("0");
  });
});
