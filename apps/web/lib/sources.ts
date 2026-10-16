import { getSourceTrackCount, listSources } from "@rulemix/spotify";
import type postgres from "postgres";
import type { MixSource } from "./db/mixes-repo";
import { env } from "./env";
import { HttpError } from "./http";
import { spotifyForUser } from "./spotify-for-user";

import type { SourceListItem } from "./sources-types";

export type { SourceListItem };

export async function sourcesForUser(
  sql: postgres.Sql,
  userId: string,
): Promise<{ sources: SourceListItem[]; maxSourceTracks: number }> {
  const max = env().MAX_SOURCE_TRACKS;
  const all = await listSources(spotifyForUser(sql, userId), userId);
  return { sources: all.map((s) => ({ ...s, tooLarge: s.trackCount > max })), maxSourceTracks: max };
}

/** Server-side source checks (ADR-0014, ADR-0017). Returns the source with its display name. */
export async function resolveAllowedSource(
  sql: postgres.Sql,
  userId: string,
  source: { type: "playlist" | "liked"; id: string | null },
): Promise<MixSource> {
  const client = spotifyForUser(sql, userId);
  const allowed = (await listSources(client, userId)).find((s) =>
    source.type === "liked" ? s.type === "liked" : s.type === "playlist" && s.id === source.id,
  );
  if (!allowed) {
    throw new HttpError(
      422,
      "source_not_allowed",
      "Pick one of your playlists, a collab or Liked Songs.",
    );
  }
  const max = env().MAX_SOURCE_TRACKS;
  const count = await getSourceTrackCount(client, source);
  if (count > max) {
    throw new HttpError(
      422,
      "source_too_large",
      `This source has ${count} songs. rulemix handles up to ${max}.`,
    );
  }
  return { type: allowed.type, id: allowed.id, name: allowed.name };
}
