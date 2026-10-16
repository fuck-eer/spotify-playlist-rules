import type { RuleKind } from "@rulemix/rules-engine";
import type { PreviewSlot } from "@/lib/preview";
import { NEUTRAL_DOT, ruleColor } from "@/lib/palette";
import type { DotItem } from "./dot-line";

/** Turns Preview slots into dots; a back-to-back repeat run becomes one looped dot. */
export function previewToDots(
  preview: PreviewSlot[],
  names: Record<string, string>,
  kinds: RuleKind[],
): DotItem[] {
  const out: DotItem[] = [];
  for (let i = 0; i < preview.length; i++) {
    const slot = preview[i]!;
    const r = slot.ruleIndex;
    const item: DotItem = { key: String(i), color: r === null ? NEUTRAL_DOT : ruleColor(r) };
    const name = names[slot.uri];
    if (name !== undefined) item.title = name;
    if (r !== null) {
      const merged = slot.ruleIndices.length > 1;
      item.label = slot.ruleIndices.map((x) => `#${x + 1}`).join("+");
      if (merged) item.colors = slot.ruleIndices.map(ruleColor);
      if (kinds[r] === "repeat" && !merged) {
        let run = 1;
        while (
          preview[i + 1]?.ruleIndex === r &&
          preview[i + 1]?.uri === slot.uri &&
          preview[i + 1]?.ruleIndices.length === 1
        ) {
          run++;
          i++;
        }
        if (run > 1) item.loop = run;
      }
    }
    if (slot.shiftedFrom !== null) item.badge = `moved from #${slot.shiftedFrom + 1}`;
    out.push(item);
  }
  return out;
}
