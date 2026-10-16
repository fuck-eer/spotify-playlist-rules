import {
  type BuildIssue,
  type BuildStats,
  type GraphNode,
  type RuleKind,
} from "@rulemix/rules-engine";
import type { SpotifyClient } from "@rulemix/spotify";
import type postgres from "postgres";
import { getMix } from "./db/mixes-repo";
import { HttpError } from "./http";
import { buildForMix } from "./mix-build";
import { readSourceTracks } from "./source-tracks";

/** Temporary v1 dot-line slot (adapter until the cover graph lands in v2-web/04). */
export interface PreviewSlot {
  uri: string;
  ruleIndex: number | null;
  ruleIndices: number[];
  shiftedFrom: number | null;
}

/** Temporary adapter: expands v2 graph nodes into the v1 dot line (one slot per play). */
export function nodesToSlots(nodes: GraphNode[]): PreviewSlot[] {
  return nodes.flatMap((n) =>
    Array.from({ length: n.plays }, () => ({
      uri: n.uri,
      ruleIndex: n.ruleIndex,
      ruleIndices: n.ruleIndices,
      shiftedFrom: n.shiftedFrom,
    })),
  );
}

export interface PreviewResponse {
  slots: PreviewSlot[];
  names: Record<string, string>;
  kinds: RuleKind[];
  stats: BuildStats;
  issues: BuildIssue[];
  summary: string;
  skippedText: string | null;
}

export function previewSummary(stats: BuildStats): string {
  const rules = stats.rulesApplied === 1 ? "rule" : "rules";
  return `${stats.total} tracks · ${stats.rulesApplied} ${rules} applied`;
}

export function skippedText(n: number): string | null {
  if (n === 0) return null;
  return `${n} ${n === 1 ? "song" : "songs"} skipped (unavailable)`;
}

/** Fresh Preview from the live Source (ADR-0013: reads only, never writes to Spotify). */
export async function computePreview(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  client: SpotifyClient,
): Promise<PreviewResponse> {
  const mix = await getMix(sql, userId, mixId);
  if (!mix) throw new HttpError(404, "not_found", "That mix doesn't exist.");
  const source = await readSourceTracks(sql, client, mix.source);
  const { result, rules: mixRules } = await buildForMix(sql, userId, mix, source);
  const names: Record<string, string> = {};
  for (const t of source) if (t) names[t.uri] = t.name;
  return {
    slots: nodesToSlots(result.nodes),
    names,
    kinds: mixRules.map((r) => r.kind),
    stats: result.stats,
    issues: result.issues,
    summary: previewSummary(result.stats),
    skippedText: skippedText(result.stats.skippedUnavailable),
  };
}
