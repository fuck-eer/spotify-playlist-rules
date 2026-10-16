import { describe, expect, it } from "vitest";
import { DRAFT_DOT, NEUTRAL_DOT, RULE_COLORS, ruleColor } from "./palette";

describe("palette", () => {
  it("has exactly 10 unique colours", () => {
    expect(RULE_COLORS).toHaveLength(10);
    expect(new Set(RULE_COLORS).size).toBe(10);
  });
  it("starts with the mockup's 5 colours", () => {
    expect(RULE_COLORS.slice(0, 5)).toEqual(["#e8b04b", "#7aa7ff", "#e57a9a", "#9ad08a", "#c9a3f0"]);
  });
  it("maps index to colour and throws outside 0-9", () => {
    expect(ruleColor(0)).toBe("#e8b04b");
    expect(ruleColor(9)).toBe("#c8b08a");
    expect(() => ruleColor(10)).toThrow(RangeError);
    expect(() => ruleColor(-1)).toThrow(RangeError);
    expect(() => ruleColor(1.5)).toThrow(RangeError);
  });
  it("exposes neutral and draft dots", () => {
    expect(NEUTRAL_DOT).toBe("#555555");
    expect(DRAFT_DOT).toBe("#ffffff");
  });
});
