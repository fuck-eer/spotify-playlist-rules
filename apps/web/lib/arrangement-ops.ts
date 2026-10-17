import type { GraphNode } from "@rulemix/rules-engine";

/** What PUT /api/mixes/{id}/arrangement takes, minus the version. */
export interface ArrangementDraft {
  manualOrder: string[] | null;
  bench: string[];
  rules: { id: string; removedPlays: number; deletedCopies: number[] }[];
}

/** Original URIs in current line order. */
export function lineOf(nodes: GraphNode[]): string[] {
  return nodes.filter((n) => n.role === "original").map((n) => n.uri);
}

/** Moves `from` to the line position currently held by `to` (both Original URIs). */
export function moveOriginal(line: string[], from: string, to: string): string[] {
  const i = line.indexOf(from);
  const j = line.indexOf(to);
  if (i < 0 || j < 0 || i === j) return [...line];
  const out = [...line];
  out.splice(i, 1);
  out.splice(j, 0, from);
  return out;
}

/** Index into `nodes` of the Original that would receive a drop, or -1. */
export function pickDropTarget(
  nodes: GraphNode[],
  positions: (i: number) => { x: number; y: number },
  x: number,
  y: number,
  draggedKey: string,
  radius = 70,
): number {
  let best = -1;
  let bestD = radius * radius;
  nodes.forEach((n, i) => {
    if (n.role !== "original" || n.key === draggedKey) return;
    const p = positions(i);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function sameArrangement(a: ArrangementDraft, b: ArrangementDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withRule(
  a: ArrangementDraft,
  ruleId: string,
  f: (r: ArrangementDraft["rules"][number]) => ArrangementDraft["rules"][number],
): ArrangementDraft {
  return { ...a, rules: a.rules.map((r) => (r.id === ruleId ? f(r) : r)) };
}

/** Benches an Original: it leaves the line (and any Manual order); its rule copies stay. */
export function benchOriginal(a: ArrangementDraft, uri: string): ArrangementDraft {
  if (a.bench.includes(uri)) return a;
  return {
    ...a,
    bench: [...a.bench, uri],
    manualOrder: a.manualOrder ? a.manualOrder.filter((u) => u !== uri) : null,
  };
}

/** Deletes Rule copy `k` of a Mix rule. */
export function deleteCopy(a: ArrangementDraft, ruleId: string, k: number): ArrangementDraft {
  return withRule(a, ruleId, (r) =>
    r.deletedCopies.includes(k)
      ? r
      : { ...r, deletedCopies: [...r.deletedCopies, k].sort((x, y) => x - y) },
  );
}

/** Deletes one play of a Repeat stack (at 1 play the server drops the Mix rule). */
export function deleteRepeatPlay(a: ArrangementDraft, ruleId: string): ArrangementDraft {
  return withRule(a, ruleId, (r) => ({ ...r, removedPlays: r.removedPlays + 1 }));
}

/** Takes a song off the bench and inserts it into `line` at `index`; sets a Manual order. */
export function restoreFromBench(
  a: ArrangementDraft,
  uri: string,
  index: number,
  line: string[],
): ArrangementDraft {
  const rest = line.filter((u) => u !== uri);
  const i = Math.max(0, Math.min(rest.length, index));
  return {
    ...a,
    bench: a.bench.filter((u) => u !== uri),
    manualOrder: [...rest.slice(0, i), uri, ...rest.slice(i)],
  };
}
