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

describe("v2 motion fixes (F08)", () => {
  const copy = (uri: number, k: number, ruleIndex = 0): GraphNode => ({
    ...node(uri),
    key: `r:x:${k}`,
    role: "copy",
    ruleIndex,
    ruleIndices: [ruleIndex],
    copyIndex: k,
  });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("a new rule copy flies in from its source cover and its ring sweeps in (#4, #7)", async () => {
    mockReduced(false);
    const base = [0, 1, 2, 3].map(node);
    const { rerender } = render(<CoverGraph nodes={base} tracks={{}} rules={[]} />);
    await wait(500);
    rerender(
      <CoverGraph
        nodes={[...base.slice(0, 2), copy(0, 0), ...base.slice(2)]}
        tracks={{}}
        rules={[{ kind: "every_n", n: 2 }]}
      />,
    );
    const fly = document.querySelector('[data-key="r:x:0"]')!;
    expect(fly.getAttribute("data-fly")).toMatch(/^-?\d+,-?\d+$/);
    expect(fly.getAttribute("data-fly")).not.toBe("0,0");
    expect(fly.getAttribute("data-sweep")).toBe("1");
    expect(fly.querySelector('[data-testid="ring-sweep"]')).toBeTruthy();
    // An Original taking a rule colour sweeps too.
    rerender(
      <CoverGraph
        nodes={[{ ...base[0]!, ruleIndex: 0, ruleIndices: [0] }, ...base.slice(1)]}
        tracks={{}}
        rules={[{ kind: "pin_first", n: null }]}
      />,
    );
    expect(document.querySelector(`[data-key="${base[0]!.key}"]`)!.getAttribute("data-sweep")).toBe(
      "1",
    );
  });

  it("reduced motion: no fly-in, no sweep", async () => {
    mockReduced(true);
    const base = [0, 1, 2].map(node);
    const { rerender } = render(<CoverGraph nodes={base} tracks={{}} rules={[]} />);
    await wait(500);
    rerender(
      <CoverGraph nodes={[...base, copy(0, 0)]} tracks={{}} rules={[{ kind: "every_n", n: 2 }]} />,
    );
    const c = document.querySelector('[data-key="r:x:0"]')!;
    expect(c.getAttribute("data-fly")).toBeNull();
    expect(c.getAttribute("data-sweep")).toBeNull();
  });

  it("a dropped cover settles from the finger, not from its slot (#10)", async () => {
    const { Cover } = await import("./cover");
    mockReduced(false);
    const props = { node: node(0), track: undefined, rules: [], style: { left: 0, top: 0 } };
    const { rerender } = render(
      <ol>
        <Cover {...props} lifted dragOffset={{ x: 40, y: 12 }} />
      </ol>,
    );
    await wait(500);
    expect(screen.getByTestId("cover").style.transform).toMatch(/translateX\(40px\)/);
    rerender(
      <ol>
        <Cover {...props} />
      </ol>,
    );
    const li = screen.getByTestId("cover");
    expect(li.style.transform).toMatch(/translateX\(40px\)/);
    await wait(700);
    expect(li.style.transform).not.toMatch(/translateX\(40px\)/);
  });

  it("reduced motion: the drop lands instantly", async () => {
    const { Cover } = await import("./cover");
    mockReduced(true);
    const props = { node: node(0), track: undefined, rules: [], style: { left: 0, top: 0 } };
    const { rerender } = render(
      <ol>
        <Cover {...props} lifted dragOffset={{ x: 40, y: 12 }} />
      </ol>,
    );
    rerender(
      <ol>
        <Cover {...props} />
      </ol>,
    );
    await wait(50);
    expect(screen.getByTestId("cover").style.transform).not.toMatch(/translateX\(40px\)/);
  });

  it("Undo toasts carry the timer line; reduced motion hides it (#27)", async () => {
    const { UNDO_TOAST } = await import("./mix-graph");
    const fs = await import("node:fs");
    const css = fs.readFileSync(`${process.cwd()}/app/globals.css`, "utf8");
    expect(css).toContain(`.${UNDO_TOAST}::after`);
    expect(css).toMatch(/animation: rm-undo-timer 4s linear/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*{\s*\[data-sonner-toast\]\.rm-undo-toast::after\s*{\s*display: none/,
    );
  });
});
