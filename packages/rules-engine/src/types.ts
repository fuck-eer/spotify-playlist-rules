export type RuleKind = "pin_first" | "every_n" | "repeat";

/** A Rule bound to a song inside a Mix. `n` is null for pin_first and MIN_N..MAX_N otherwise. */
export interface MixRuleInput {
  kind: RuleKind;
  uri: string;
  n: number | null;
}

/** A Source playlist item; null is an Unavailable track. */
export type SourceItem = { uri: string; name: string; artists: string[] } | null;

export interface BuildInput {
  /** Source playlist items in Spotify order (may contain null). */
  source: SourceItem[];
  /** Rule Set, index 0 = highest priority. */
  rules: MixRuleInput[];
  /** false = seeded shuffle (ADR-0004). */
  keepSourceOrder: boolean;
  /** uint32 Seed. */
  seed: number;
}

/** One Preview slot; positions are 0-based. */
export interface PreviewSlot {
  uri: string;
  ruleIndex: number | null;
  shiftedFrom: number | null;
}

export type BuildIssue = { kind: "unavailable_rule_song"; ruleIndex: number };

export interface BuildStats {
  total: number;
  rulesApplied: number;
  skippedUnavailable: number;
}

export interface BuildResult {
  uris: string[];
  preview: PreviewSlot[];
  issues: BuildIssue[];
  stats: BuildStats;
}

export const MIN_N = 2;
export const MAX_N = 10;
