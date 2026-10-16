import {
  build,
  type BuildIssue,
  type BuildStats,
  type PreviewSlot,
  type RuleKind,
} from "@rulemix/rules-engine";
import type { SpotifyClient } from "@rulemix/spotify";
import type postgres from "postgres";
import { listMixRules } from "./db/mix-rules-repo";
import { getMix } from "./db/mixes-repo";
import { HttpError } from "./http";
import { readSourceTracks } from "./source-tracks";

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
  const [mixRules, source] = await Promise.all([
    listMixRules(sql, userId, mixId),
    readSourceTracks(sql, client, mix.source),
  ]);
  const result = build({
    source,
    rules: mixRules.map((r) => ({ kind: r.kind, n: r.n, uri: r.trackUri })),
    keepSourceOrder: mix.keepSourceOrder,
    seed: mix.shuffleSeed,
  });
  const names: Record<string, string> = {};
  for (const t of source) if (t) names[t.uri] = t.name;
  return {
    slots: result.preview,
    names,
    kinds: mixRules.map((r) => r.kind),
    stats: result.stats,
    issues: result.issues,
    summary: previewSummary(result.stats),
    skippedText: skippedText(result.stats.skippedUnavailable),
  };
}
