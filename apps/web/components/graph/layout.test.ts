import { describe, expect, it } from "vitest";
import { layout, nearestIndex } from "./layout";

describe("layout", () => {
  it("uses floor(width / 72) columns with a minimum of 3", () => {
    expect(layout(20, 300).cols).toBe(4);
    expect(layout(20, 1000).cols).toBe(13);
    expect(layout(20, 100).cols).toBe(3);
  });

  it("n = 1 and n = 3 at width 300: one row, left to right", () => {
    expect(layout(1, 300).pos(0)).toEqual({ x: 36, y: 46, row: 0, col: 0 });
    const l = layout(3, 300);
    expect([0, 1, 2].map((i) => l.pos(i).x)).toEqual([36, 108, 180]);
    expect(l.height).toBe(92);
  });

  it("n = 7 at width 300: row 2 runs right to left", () => {
    const l = layout(7, 300);
    expect(l.rows).toBe(2);
    expect(l.pos(4)).toEqual({ x: 252, y: 138, row: 1, col: 3 });
    expect(l.pos(6)).toEqual({ x: 108, y: 138, row: 1, col: 1 });
    expect(l.height).toBe(184);
  });

  it("n = 20 at width 1000 and 300", () => {
    const wide = layout(20, 1000);
    expect(wide.rows).toBe(2);
    expect(wide.pos(13)).toEqual({ x: 12 * 72 + 36, y: 138, row: 1, col: 12 });
    expect(wide.pos(19).col).toBe(6);
    const narrow = layout(20, 300);
    expect(narrow.rows).toBe(5);
    expect(narrow.height).toBe(460);
    expect(narrow.pos(19)).toEqual({ x: 252, y: 4 * 92 + 46, row: 4, col: 3 });
  });

  it("nearestIndex finds the closest allowed node within the radius", () => {
    const l = layout(7, 300);
    expect(nearestIndex(l, 7, 110, 50, 70)).toBe(1);
    expect(nearestIndex(l, 7, 110, 50, 80, (i) => i !== 1)).toBe(2);
    expect(nearestIndex(l, 7, 2000, 2000, 70)).toBe(-1);
  });
});
