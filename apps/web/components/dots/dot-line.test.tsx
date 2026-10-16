import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DotLine, type DotItem } from "./dot-line";

afterEach(cleanup);
const items = (n: number): DotItem[] => Array.from({ length: n }, (_, i) => ({ key: String(i), color: "#555555" }));

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
    const { container } = render(<DotLine items={[{ key: "a", color: "#e8b04b", label: "#1", badge: "moved from #4" }]} ariaLabel="line" />);
    expect(screen.getAllByText("moved from #4").length).toBeGreaterThan(0);
    expect(container.querySelector("title")?.textContent).toContain("moved from #4");
    expect(screen.getByText("#1")).toBeTruthy();
  });
  it("has the aria-label", () => {
    render(<DotLine items={items(2)} ariaLabel="Preview line" />);
    expect(screen.getByLabelText("Preview line")).toBeTruthy();
  });
});
