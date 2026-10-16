import type { MixRow } from "./db/mixes-repo";

function relative(iso: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Home row meta: `{sourceName} · {ruleCount} rules · {relative lastSavedAt | not generated}`. */
export function mixMetaLine(
  m: Pick<MixRow, "source" | "ruleCount" | "lastSavedAt">,
  now: Date = new Date(),
): string {
  const rules = `${m.ruleCount} ${m.ruleCount === 1 ? "rule" : "rules"}`;
  const saved = m.lastSavedAt ? relative(m.lastSavedAt, now) : "not generated";
  return `${m.source.name} · ${rules} · ${saved}`;
}
