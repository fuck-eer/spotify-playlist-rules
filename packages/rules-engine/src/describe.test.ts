import { describe, expect, it } from "vitest";
import { mixRuleCardLine, ruleCaption, ruleSentence } from "./describe.js";

describe("rule copy", () => {
  it("ruleSentence", () => {
    expect(ruleSentence("pin_first", null)).toBe("Play a song first");
    expect(ruleSentence("repeat", 4)).toBe("Play a song 4 times in a row");
    expect(ruleSentence("every_n", 4)).toBe("Play a song after every 4 songs");
  });
  it("ruleCaption", () => {
    expect(ruleCaption("pin_first", null)).toBe("#01 · this song leads the mix");
    expect(ruleCaption("repeat", 4)).toBe("4× · same song, in a row");
    expect(ruleCaption("every_n", 4)).toBe("every 4 · lands after each 4 songs");
  });
  it("mixRuleCardLine", () => {
    expect(mixRuleCardLine("pin_first", null, "Song")).toBe("Pin first · Song");
    expect(mixRuleCardLine("repeat", 4, "Song")).toBe("Repeat · Song · 4×");
    expect(mixRuleCardLine("every_n", 4, "Song")).toBe("Every 4 · Song");
  });
});
