// Mirrors the @rulemix/rules-engine contract from ticket 02. Replace with imports from
// "@rulemix/rules-engine" once ticket 02 is merged.
export type RuleKind = "pin_first" | "every_n" | "repeat";
export interface PreviewSlot {
  uri: string;
  ruleIndex: number | null;
  shiftedFrom: number | null;
}
