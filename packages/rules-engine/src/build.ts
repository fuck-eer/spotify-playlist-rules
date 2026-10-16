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

function everyNCount(baseLength: number, n: number): number {
  return Math.max(1, Math.floor(baseLength / n));
}

function countFor(rule: MixRuleInput, baseLength: number): number {
  if (rule.kind === "pin_first") return 1;
  const n = rule.n ?? 0;
  // ADR-0019: an every_n rule always places at least one copy, even for a tiny Base list.
  return rule.kind === "every_n" ? everyNCount(baseLength, n) : n;
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
    return Array.from({ length: everyNCount(baseLength, n) }, (_, i) =>
      Math.min((i + 1) * (n + 1) - 1, total - 1),
    );
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
      const taken = slots[p] ?? null;
      if (taken === null) {
        slots[p] = { uri: rule.uri, ruleIndex, ruleIndices: [ruleIndex], shiftedFrom: null };
      } else if (
        rule.kind === "every_n" &&
        taken.uri === rule.uri &&
        !taken.ruleIndices.includes(ruleIndex)
      ) {
        // ADR-0020: the slot already plays this song, so both rules share it; one slot fewer.
        taken.ruleIndices.push(ruleIndex);
      } else {
        slots[findFreeSlot(slots, p)] = {
          uri: rule.uri,
          ruleIndex,
          ruleIndices: [ruleIndex],
          shiftedFrom: p,
        };
      }
    }
  }

  // Fill free slots with the Base list in order. Merges leave as many free slots unused as
  // there were merges; those are the last free ones and are dropped.
  let next = 0;
  const preview: PreviewSlot[] = [];
  for (const slot of slots) {
    if (slot !== null) preview.push(slot);
    else if (next < b) {
      preview.push({
        uri: baseList[next++] as string,
        ruleIndex: null,
        ruleIndices: [],
        shiftedFrom: null,
      });
    }
  }

  return {
    uris: preview.map((s) => s.uri),
    preview,
    issues,
    stats: {
      total: preview.length,
      rulesApplied: active.length,
      skippedUnavailable,
    },
  };
}
