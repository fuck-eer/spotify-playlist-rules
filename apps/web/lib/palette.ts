/** Rule colours, by position in the Rule Set (ADR-0017). Mirrored as --color-r1..r10 in globals.css. */
export const RULE_COLORS = [
  "#e8b04b", // amber
  "#7aa7ff", // blue
  "#e57a9a", // rose
  "#9ad08a", // sage
  "#c9a3f0", // lilac
  "#5fcfc4", // teal
  "#f0895a", // coral
  "#d8d36a", // citron
  "#8f96f0", // periwinkle
  "#c8b08a", // sand
] as const;

export const NEUTRAL_DOT = "#555555";
export const DRAFT_DOT = "#ffffff";

export function ruleColor(index: number): string {
  const c = Number.isInteger(index) ? RULE_COLORS[index] : undefined;
  if (c === undefined) throw new RangeError(`rule index out of range 0-9: ${index}`);
  return c;
}
