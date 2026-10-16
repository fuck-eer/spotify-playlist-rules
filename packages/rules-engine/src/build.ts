import { seededShuffle } from "./prng.js";
import {
  MAX_N,
  MIN_N,
  type BuildInput,
  type BuildIssue,
  type BuildResult,
  type MixRuleInput,
  type PreviewSlot,
} from "./types.js";

const TRACK_PREFIX = "spotify:track:";

function assertValid(input: BuildInput): void {
  const { seed, rules } = input;
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
    throw new RangeError(`seed must be an integer in [0, 2^32), got ${seed}`);
  }
  rules.forEach((rule, i) => {
    if (rule.kind === "pin_first") {
      if (rule.n !== null) throw new RangeError(`rules[${i}]: pin_first requires n = null`);
    } else if (rule.n === null || !Number.isInteger(rule.n) || rule.n < MIN_N || rule.n > MAX_N) {
      throw new RangeError(
        `rules[${i}]: ${rule.kind} requires an integer n in [${MIN_N}, ${MAX_N}]`,
      );
    }
  });
}

function countFor(rule: MixRuleInput, baseLength: number): number {
  if (rule.kind === "pin_first") return 1;
  const n = rule.n ?? 0;
  return rule.kind === "every_n" ? Math.floor(baseLength / n) : n;
}

function desiredPositions(
  rule: MixRuleInput,
  baseLength: number,
  total: number,
  ordered: readonly string[],
): number[] {
  const n = rule.n ?? 0;
  if (rule.kind === "pin_first") return [0];
  if (rule.kind === "every_n") {
    return Array.from({ length: Math.floor(baseLength / n) }, (_, i) => (i + 1) * (n + 1) - 1);
  }
  const start = Math.min(ordered.indexOf(rule.uri), total - n);
  return Array.from({ length: n }, (_, i) => start + i);
}

function findFreeSlot(slots: readonly (PreviewSlot | null)[], p: number): number {
  for (let q = p + 1; q < slots.length; q++) if (slots[q] === null) return q;
  for (let q = p - 1; q >= 0; q--) if (slots[q] === null) return q;
  throw new Error("no free slot: slot accounting is inconsistent");
}

/** Pure, deterministic: Source items + Rule Set + Seed → final track list and Preview. */
export function build(input: BuildInput): BuildResult {
  assertValid(input);

  const available: string[] = [];
  for (const item of input.source) {
    if (item !== null && item.uri.startsWith(TRACK_PREFIX)) available.push(item.uri);
  }
  const skippedUnavailable = input.source.length - available.length;

  const ordered = input.keepSourceOrder ? available : seededShuffle(available, input.seed);

  const issues: BuildIssue[] = [];
  const active: { rule: MixRuleInput; ruleIndex: number }[] = [];
  const availableSet = new Set(ordered);
  input.rules.forEach((rule, ruleIndex) => {
    if (availableSet.has(rule.uri)) active.push({ rule, ruleIndex });
    else issues.push({ kind: "unavailable_rule_song", ruleIndex });
  });

  const ruleUris = new Set(active.map((a) => a.rule.uri));
  const baseList = ordered.filter((uri) => !ruleUris.has(uri));
  const b = baseList.length;

  const counts = active.map((a) => countFor(a.rule, b));
  const total = b + counts.reduce((sum, c) => sum + c, 0);

  const slots: (PreviewSlot | null)[] = Array.from({ length: total }, () => null);
  for (const { rule, ruleIndex } of active) {
    for (const p of desiredPositions(rule, b, total, ordered)) {
      if (slots[p] === null) {
        slots[p] = { uri: rule.uri, ruleIndex, shiftedFrom: null };
      } else {
        slots[findFreeSlot(slots, p)] = { uri: rule.uri, ruleIndex, shiftedFrom: p };
      }
    }
  }

  let next = 0;
  const preview: PreviewSlot[] = slots.map(
    (slot) => slot ?? { uri: baseList[next++] as string, ruleIndex: null, shiftedFrom: null },
  );

  return {
    uris: preview.map((s) => s.uri),
    preview,
    issues,
    stats: {
      total,
      rulesApplied: counts.filter((c) => c > 0).length,
      skippedUnavailable,
    },
  };
}
