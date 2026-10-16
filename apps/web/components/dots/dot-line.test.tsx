import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DotLine, type DotItem } from "./dot-line";

afterEach(cleanup);
const items = (n: number): DotItem[] =>
  Array.from({ length: n }, (_, i) => ({ key: String(i), color: "#555555" }));

describe("DotLine", () => {
  it("caps at maxDots and shows +n more", () => {
    const { container } = render(<DotLine items={items(30)} maxDots={22} ariaLabel="line" />);
    expect(container.querySelectorAll("circle")).toHaveLength(22);
    expect(screen.getByText("+8 more")).toBeTruthy();
  });
  it("renders loop text", () => {
    render(<DotLine items={[{ key: "a", color: "#e8b04b", loop: 3 }]} ariaLabel="line" />);
    expect(screen.getByText("3×")).toBeTruthy();
  });
  it("renders badge text and label", () => {
    const { container } = render(
      <DotLine
        items={[{ key: "a", color: "#e8b04b", label: "#1", badge: "moved from #4" }]}
        ariaLabel="line"
      />,
    );
    expect(screen.getAllByText("moved from #4").length).toBeGreaterThan(0);
    expect(container.querySelector("title")?.textContent).toContain("moved from #4");
    expect(screen.getByText("#1")).toBeTruthy();
  });
  it("draws a split dot with one segment per colour", () => {
    const { container } = render(
      <DotLine
        items={[{ key: "a", color: "#e8b04b", colors: ["#e8b04b", "#e86ba8"] }]}
        ariaLabel="line"
      />,
    );
    const segs = container.querySelectorAll("[data-segment]");
    expect(segs).toHaveLength(2);
    expect([...segs].map((x) => x.getAttribute("fill"))).toEqual(["#e8b04b", "#e86ba8"]);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });
  it("draws three equal segments for three rules", () => {
    const { container } = render(
      <DotLine
        items={[{ key: "a", color: "#111", colors: ["#111", "#222", "#333"] }]}
        ariaLabel="line"
      />,
    );
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(3);
  });
  it("has the aria-label", () => {
    render(<DotLine items={items(2)} ariaLabel="Preview line" />);
    expect(screen.getByLabelText("Preview line")).toBeTruthy();
  });
});
