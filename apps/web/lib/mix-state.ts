import type { SourceItem } from "@rulemix/rules-engine";
import type { SpotifyClient } from "@rulemix/spotify";
import type postgres from "postgres";
import { getArrangement, pruneToSource } from "./db/arrangement-repo";
import { listMixRules, type MixRuleRow } from "./db/mix-rules-repo";
import { getMix, type MixRow } from "./db/mixes-repo";
import { HttpError } from "./http";
import { readSourceTracks } from "./source-tracks";

export interface TrackMeta {
  name: string;
  artists: string[];
  imageUrl: string | null;
}

export interface MixState {
  mix: MixRow;
  rules: MixRuleRow[];
  source: SourceItem[];
  tracks: Record<string, TrackMeta>;
  arrangement: { manualOrder: string[] | null; bench: string[]; version: number };
}

/** Everything a client needs to build the graph locally; prunes Source-deleted songs (ADR-0028/0030). */
export async function getMixState(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  client: SpotifyClient,
): Promise<MixState> {
  const mix = await getMix(sql, userId, mixId);
  if (!mix) throw new HttpError(404, "not_found", "That mix doesn't exist.");
  const items = await readSourceTracks(sql, client, mix.source);
  const available = new Set<string>();
  const tracks: Record<string, TrackMeta> = {};
  for (const t of items) {
    if (!t) continue;
    available.add(t.uri);
    tracks[t.uri] = { name: t.name, artists: t.artists, imageUrl: t.imageUrl ?? null };
  }
  await pruneToSource(sql, userId, mixId, available);
  const [rules, arrangement] = await Promise.all([
    listMixRules(sql, userId, mixId),
    getArrangement(sql, userId, mixId),
  ]);
  if (!arrangement) throw new HttpError(404, "not_found", "That mix doesn't exist.");
  // Rule songs not in the Source (ADR-0030: their copies survive) still need names.
  const missing = rules.map((r) => r.trackUri).filter((u) => !tracks[u]);
  if (missing.length > 0) {
    const rows = await sql<
      { uri: string; name: string; artists: string[]; image_url: string | null }[]
    >`
      select uri, name, artists, image_url from track_cache where uri = any(${missing}::text[])`;
    for (const r of rows)
      tracks[r.uri] = { name: r.name, artists: r.artists, imageUrl: r.image_url };
  }
  return {
    mix,
    rules,
    source: items.map((t) => (t ? { uri: t.uri, name: t.name, artists: t.artists } : null)),
    tracks,
    arrangement: {
      manualOrder: arrangement.manualOrder,
      bench: arrangement.bench,
      version: arrangement.version,
    },
  };
}
