import { describe, expect, it } from "vitest";
import { NEUTRAL_DOT, ruleColor } from "@/lib/palette";
import { previewToDots } from "./collapse-preview";

const s = (uri: string, ruleIndex: number | null, shiftedFrom: number | null = null) => ({
  uri,
  ruleIndex,
  shiftedFrom,
});

describe("previewToDots", () => {
  it("collapses a repeat run of 3 into one looped dot", () => {
    const dots = previewToDots([s("a", null), s("r", 0), s("r", 0), s("r", 0), s("b", null)], {}, [
      "repeat",
    ]);
    expect(dots).toHaveLength(3);
    expect(dots[1]).toMatchObject({ loop: 3, color: ruleColor(0), label: "#1", key: "1" });
  });
  it("does not collapse adjacent pin / every_n dots", () => {
    const dots = previewToDots([s("p", 0), s("e", 1), s("e", 1)], {}, ["pin_first", "every_n"]);
    expect(dots).toHaveLength(3);
    expect(dots.every((d) => d.loop === undefined)).toBe(true);
  });
  it("adds a 1-based shifted badge", () => {
    const dots = previewToDots([s("e", 1, 4)], {}, ["pin_first", "every_n"]);
    expect(dots[0]?.badge).toBe("moved from #5");
  });
  it("gives base slots the neutral colour and no label", () => {
    const dots = previewToDots([s("a", null)], { a: "Song A" }, []);
    expect(dots[0]?.color).toBe(NEUTRAL_DOT);
    expect(dots[0]?.label).toBeUndefined();
    expect(dots[0]?.key).toBe("0");
  });
});
