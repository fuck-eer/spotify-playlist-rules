import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DRAFT_DOT, NEUTRAL_DOT } from "@/lib/palette";
import { RuleIntentGraphic } from "./rule-intent-graphic";

afterEach(cleanup);
const fills = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("circle")).map((e) => e.getAttribute("fill"));

describe("RuleIntentGraphic", () => {
  it("every_n n=4 colours indices 4 and 9", () => {
    const f = fills(render(<RuleIntentGraphic kind="every_n" n={4} />).container);
    expect(f).toHaveLength(12);
    f.forEach((x, i) => expect(x).toBe(i === 4 || i === 9 ? DRAFT_DOT : NEUTRAL_DOT));
  });
  it("pin_first colours index 0", () => {
    const f = fills(
      render(<RuleIntentGraphic kind="pin_first" n={null} color="#e8b04b" />).container,
    );
    expect(f[0]).toBe("#e8b04b");
    expect(f.slice(1).every((x) => x === NEUTRAL_DOT)).toBe(true);
  });
  it("repeat puts a looped dot at index 3", () => {
    const { container, getByText } = render(<RuleIntentGraphic kind="repeat" n={4} />);
    expect(fills(container)[3]).toBe(DRAFT_DOT);
    expect(getByText("4×")).toBeTruthy();
  });
});
