import type { SpotifyClient } from "./client.js";
import { SpotifyForbiddenError, SpotifyNotFoundError } from "./errors.js";

export const WRITE_CHUNK = 100;

export interface WriteTargetInput {
  targetPlaylistId: string | null;
  /** "Rules: <mix name>" */
  defaultName: string;
  uris: string[];
  onProgress?: (done: number, total: number) => void;
}

export interface WriteTargetResult {
  playlistId: string;
  snapshotId: string;
  recreated: boolean;
  created: boolean;
  tracksWritten: number;
}

const DESCRIPTION = "Made by rulemix. Play with shuffle off.";

export { targetName } from "./names.js";

/** Whether the user still has the playlist in their library (ADR-0016). 404/403/[false] mean missing. */
async function targetExists(c: SpotifyClient, id: string): Promise<boolean> {
  const q = encodeURIComponent(`spotify:playlist:${id}`);
  try {
    const { data } = await c.request<boolean[]>("GET", `/me/library/contains?uris=${q}`);
    return Array.isArray(data) && data[0] === true;
  } catch (e) {
    if (e instanceof SpotifyNotFoundError || e instanceof SpotifyForbiddenError) return false;
    throw e;
  }
}

/** Write an engine result into a Mix's Target playlist, creating or recreating it as needed. */
export async function writeTarget(c: SpotifyClient, input: WriteTargetInput): Promise<WriteTargetResult> {
  const { targetPlaylistId, defaultName, uris, onProgress } = input;
  let playlistId = targetPlaylistId;
  let created = false;
  if (playlistId === null || !(await targetExists(c, playlistId))) {
    const { data } = await c.request<{ id: string }>("POST", "/me/playlists", {
      name: defaultName,
      public: false,
      description: DESCRIPTION,
    });
    playlistId = data.id;
    created = true;
  }
  const path = `/playlists/${encodeURIComponent(playlistId)}/items`;
  let snapshotId = "";
  let written = 0;
  do {
    const chunk = uris.slice(written, written + WRITE_CHUNK);
    const { data } = await c.request<{ snapshot_id: string }>(written === 0 ? "PUT" : "POST", path, { uris: chunk });
    snapshotId = data.snapshot_id;
    written += chunk.length;
    onProgress?.(written, uris.length);
  } while (written < uris.length);
  return { playlistId, snapshotId, created, recreated: created && targetPlaylistId !== null, tracksWritten: written };
}
