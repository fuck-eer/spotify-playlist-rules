import {
  getSourceTrackCount,
  readLikedSongs,
  readPlaylistItems,
  type ReadProgress,
  type SpotifyClient,
  type TrackItem,
} from "@rulemix/spotify";
import type postgres from "postgres";
import { env } from "./env";
import { HttpError } from "./http";

export type SourceRef = { type: "playlist" | "liked"; id: string | null };

/** Reads a Source's items (null = Unavailable track) after checking MAX_SOURCE_TRACKS; caches names. */
export async function readSourceTracks(
  sql: postgres.Sql,
  client: SpotifyClient,
  source: SourceRef,
  onProgress?: ReadProgress,
): Promise<(TrackItem | null)[]> {
  const max = env().MAX_SOURCE_TRACKS;
  const count = await getSourceTrackCount(client, source);
  if (count > max) {
    throw new HttpError(
      422,
      "source_too_large",
      `This source has ${count} songs. rulemix handles up to ${max}.`,
    );
  }
  let items: (TrackItem | null)[];
  if (source.type === "liked") {
    items = await readLikedSongs(client, onProgress);
  } else {
    if (!source.id) throw new TypeError("playlist source needs an id");
    items = await readPlaylistItems(client, source.id, onProgress);
  }
  await cacheTracks(sql, items);
  return items;
}

async function cacheTracks(sql: postgres.Sql, items: (TrackItem | null)[]): Promise<void> {
  const byUri = new Map<string, TrackItem>();
  for (const t of items) if (t) byUri.set(t.uri, t);
  if (byUri.size === 0) return;
  const rows = [...byUri.values()];
  await sql`
    insert into track_cache (uri, name, artists, fetched_at)
    select u.uri, u.name, array(select jsonb_array_elements_text(u.artists)), now()
    from jsonb_to_recordset(${sql.json(rows.map((t) => ({ uri: t.uri, name: t.name, artists: t.artists })))})
      as u(uri text, name text, artists jsonb)
    on conflict (uri) do update set name = excluded.name, artists = excluded.artists, fetched_at = now()`;
}

/** Available tracks de-duplicated by uri, in source order (song picker). */
export function uniqueAvailable(items: (TrackItem | null)[]): TrackItem[] {
  const seen = new Set<string>();
  const out: TrackItem[] = [];
  for (const t of items) {
    if (!t || seen.has(t.uri)) continue;
    seen.add(t.uri);
    out.push(t);
  }
  return out;
}
