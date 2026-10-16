import type { GraphNode, RuleKind } from "@rulemix/rules-engine";

export interface RuleMeta {
  kind: RuleKind;
  n: number | null;
}

export interface TrackMeta {
  name: string;
  artists: string[];
  imageUrl: string | null;
}

export function ruleName(r: RuleMeta): string {
  if (r.kind === "pin_first") return "Start with";
  if (r.kind === "every_n") return `After every ${r.n}`;
  return `Repeat x${r.n}`;
}

/** 1-based slot label; a stack shows its range, e.g. `5-7`. */
export function slotLabel(node: GraphNode): string {
  const first = node.firstSlot + 1;
  return node.plays > 1 ? `${first}-${first + node.plays - 1}` : `${first}`;
}

/** interaction-spec §8 aria-label. */
export function coverLabel(
  node: GraphNode,
  track: TrackMeta | undefined,
  rules: RuleMeta[],
): string {
  const song = track ? `${track.name} by ${track.artists.join(", ")}` : "Unknown song";
  const base = `Slot ${slotLabel(node)}, ${song}`;
  if (node.ruleIndex === null) return base;
  const names = node.ruleIndices
    .map((i) => rules[i])
    .filter((r): r is RuleMeta => !!r)
    .map(ruleName);
  const nums = node.ruleIndices.map((i) => `#${i + 1}`).join(" and ");
  const label = `${base}, rule ${nums} ${names.join(" and ")}`;
  return node.shiftedFrom === null ? label : `${label}, moved from #${node.shiftedFrom + 1}`;
}

export function summaryText(total: number, ruleCount: number, manual: boolean): string {
  const s = `${total} ${total === 1 ? "song" : "songs"} · ${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`;
  return manual ? `${s} · your order` : s;
}
