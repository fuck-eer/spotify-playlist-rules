import { seededShuffle } from "./prng.js";
import {
  MAX_N,
  MIN_N,
  type BuildInput,
  type BuildIssue,
  type BuildResult,
  type GraphNode,
  type MixRuleInput,
} from "./types.js";

const TRACK_PREFIX = "spotify:track:";

function assertValid(input: BuildInput): void {
  const { seed, rules } = input;
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
    throw new RangeError(`seed must be an integer in [0, 2^32), got ${seed}`);
  }
  const ids = new Set<string>();
  rules.forEach((rule, i) => {
    if (ids.has(rule.id)) throw new RangeError(`rules[${i}]: duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    if (rule.kind === "pin_first") {
      if (rule.n !== null) throw new RangeError(`rules[${i}]: pin_first requires n = null`);
    } else if (rule.n === null || !Number.isInteger(rule.n) || rule.n < MIN_N || rule.n > MAX_N) {
      throw new RangeError(
        `rules[${i}]: ${rule.kind} requires an integer n in [${MIN_N}, ${MAX_N}]`,
      );
    }
    const rp = rule.removedPlays;
    if (!Number.isInteger(rp) || rp < 0) {
      throw new RangeError(`rules[${i}]: removedPlays must be an integer >= 0`);
    }
    if (rule.kind === "repeat" ? rp >= (rule.n ?? 0) : rp !== 0) {
      throw new RangeError(`rules[${i}]: removedPlays must be < n for repeat and 0 otherwise`);
    }
    if (rule.deletedCopies.some((c) => !Number.isInteger(c) || c < 0)) {
      throw new RangeError(`rules[${i}]: deletedCopies must be integers >= 0`);
    }
  });
}

type Draft = Omit<GraphNode, "firstSlot">;

function findFreeSlot(slots: readonly (Draft | null)[], p: number): number {
  for (let q = p + 1; q < slots.length; q++) if (slots[q] === null) return q;
  for (let q = p - 1; q >= 0; q--) if (slots[q] === null) return q;
  throw new Error("no free slot: slot accounting is inconsistent");
}

function copyCount(rule: MixRuleInput, b: number): number {
  if (rule.kind === "pin_first") return 1;
  // ADR-0019: an every_n rule always places at least one copy.
  if (rule.kind === "every_n") return Math.max(1, Math.floor(b / (rule.n ?? 1)));
  return 0;
}

/** Pure, deterministic: Source + Rule Set + Seed + arrangement → cover graph and track list. */
export function build(input: BuildInput): BuildResult {
  assertValid(input);

  // 1. available, de-duplicated by first occurrence.
  const available: string[] = [];
  const seen = new Set<string>();
  let skippedUnavailable = 0;
  for (const item of input.source) {
    if (item === null || !item.uri.startsWith(TRACK_PREFIX)) skippedUnavailable++;
    else if (!seen.has(item.uri)) {
      seen.add(item.uri);
      available.push(item.uri);
    }
  }

  // 2. line: Manual order (+ new Source songs appended) or Source/shuffled order; minus Bench.
  let ordered: string[];
  if (input.manualOrder !== null) {
    const picked = new Set<string>();
    ordered = [];
    for (const uri of input.manualOrder) {
      if (seen.has(uri) && !picked.has(uri)) {
        picked.add(uri);
        ordered.push(uri);
      }
    }
    for (const uri of available) if (!picked.has(uri)) ordered.push(uri);
  } else {
    ordered = input.keepSourceOrder ? available : seededShuffle(available, input.seed);
  }
  const bench = new Set(input.bench);
  const line = ordered.filter((uri) => !bench.has(uri));
  const onLine = new Set(line);
  const benched = ordered.length - line.length;

  // 3. slot counts.
  const b = line.length;
  const counts = input.rules.map((r) => copyCount(r, b));
  const total = b + counts.reduce((s, c) => s + c, 0);

  const issues: BuildIssue[] = [];
  let rulesApplied = 0;
  input.rules.forEach((rule, ruleIndex) => {
    if (rule.kind === "repeat") {
      if (onLine.has(rule.uri)) rulesApplied++;
      else issues.push({ kind: "rule_song_not_in_source", ruleIndex });
    } else {
      rulesApplied++;
      if (!seen.has(rule.uri)) issues.push({ kind: "rule_song_not_in_source", ruleIndex });
    }
  });

  // 4. claim rule slots in priority order.
  const slots: (Draft | null)[] = Array.from({ length: total }, () => null);
  input.rules.forEach((rule, ruleIndex) => {
    if (rule.kind === "repeat") return;
    const positions =
      rule.kind === "pin_first"
        ? [0]
        : Array.from({ length: counts[ruleIndex] ?? 0 }, (_, i) =>
            Math.min((i + 1) * ((rule.n ?? 0) + 1) - 1, total - 1),
          );
    positions.forEach((p, i) => {
      const copyIndex = rule.kind === "pin_first" ? 0 : i + 1;
      const taken = slots[p] ?? null;
      const node = (shiftedFrom: number | null): Draft => ({
        key: `r:${rule.id}:${copyIndex}`,
        role: "copy",
        uri: rule.uri,
        plays: 1,
        ruleIndex,
        ruleIndices: [ruleIndex],
        shiftedFrom,
        copyIndex,
      });
      if (taken === null) slots[p] = node(null);
      else if (
        rule.kind === "every_n" &&
        taken.uri === rule.uri &&
        !taken.ruleIndices.includes(ruleIndex)
      ) {
        // ADR-0020: same song already at this slot, both rules share it.
        taken.ruleIndices.push(ruleIndex);
      } else slots[findFreeSlot(slots, p)] = node(p);
    });
  });

  // 5. fill free slots with the line; trailing free slots left by merges are dropped.
  const repeatFor = new Map<string, number>();
  input.rules.forEach((rule, i) => {
    if (rule.kind === "repeat" && !repeatFor.has(rule.uri)) repeatFor.set(rule.uri, i);
  });
  let next = 0;
  const drafts: Draft[] = [];
  for (const slot of slots) {
    if (slot !== null) drafts.push(slot);
    else if (next < b) {
      const uri = line[next++] as string;
      const ri = repeatFor.get(uri);
      const rule = ri === undefined ? undefined : input.rules[ri];
      const plays = rule ? Math.max(1, (rule.n ?? 1) - rule.removedPlays) : 1;
      const stack = plays >= 2 && ri !== undefined;
      drafts.push({
        key: `b:${uri}`,
        role: "original",
        uri,
        plays,
        ruleIndex: stack ? ri : null,
        ruleIndices: stack ? [ri] : [],
        shiftedFrom: null,
        copyIndex: null,
      });
    }
  }

  // 6. remove deleted copies; later nodes move up.
  const deleted = new Set<string>();
  for (const rule of input.rules) {
    for (const c of rule.deletedCopies) deleted.add(`r:${rule.id}:${c}`);
  }
  const kept = drafts.filter((d) => !deleted.has(d.key));

  // 7. expand plays.
  const nodes: GraphNode[] = [];
  const uris: string[] = [];
  for (const d of kept) {
    nodes.push({ ...d, firstSlot: uris.length });
    for (let i = 0; i < d.plays; i++) uris.push(d.uri);
  }

  return {
    uris,
    nodes,
    issues,
    stats: { total: uris.length, rulesApplied, skippedUnavailable, benched },
  };
}
