export type RuleKind = "pin_first" | "every_n" | "repeat";

/** A Rule bound to a song inside a Mix. `n` is null for pin_first and MIN_N..MAX_N otherwise. */
export interface MixRuleInput {
  /** The Mix rule id (keys Rule copies, ADR-0030). */
  id: string;
  kind: RuleKind;
  uri: string;
  n: number | null;
  /** Repeat only: plays deleted from the stack (0 <= removedPlays < n). 0 for other kinds. */
  removedPlays: number;
  /** Deleted Rule copies by copy index (0 = Start with, 1.. = every-N copy k). */
  deletedCopies: number[];
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
  /** Manual order of Original URIs (ADR-0028), or null. */
  manualOrder: string[] | null;
  /** Benched Original URIs (ADR-0030). */
  bench: string[];
}

/** One node of the cover graph. */
export interface GraphNode {
  /** "b:<uri>" Original, "r:<mixRuleId>:<k>" Rule copy. */
  key: string;
  role: "original" | "copy";
  uri: string;
  /** >= 2 only for a Repeat stack. */
  plays: number;
  /** Copy's rule, or the Repeat rule on a stack; null for plain Originals. */
  ruleIndex: number | null;
  /** Every rule on this node (merged slots, ADR-0020). */
  ruleIndices: number[];
  shiftedFrom: number | null;
  copyIndex: number | null;
  /** 0-based play position of the node's first play. */
  firstSlot: number;
}

export type BuildIssue = { kind: "rule_song_not_in_source"; ruleIndex: number };

export interface BuildStats {
  total: number;
  rulesApplied: number;
  skippedUnavailable: number;
  benched: number;
}

export interface BuildResult {
  uris: string[];
  nodes: GraphNode[];
  issues: BuildIssue[];
  stats: BuildStats;
}

export const MIN_N = 2;
export const MAX_N = 10;
