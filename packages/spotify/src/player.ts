import type { SpotifyClient } from "./client.js";

export const PLAYER_PLAYLIST_NAME = "rulemix player";
export const PLAYER_PLAYLIST_DESCRIPTION = "Managed by rulemix. Play with shuffle off.";

const PLAYBACK_SCOPES = ["user-read-playback-state", "user-modify-playback-state"] as const;

/** Whether a space-separated scope string allows remote play (ADR-0023). */
export function hasPlaybackScopes(scope: string): boolean {
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return PLAYBACK_SCOPES.every((s) => granted.has(s));
}

interface Device {
  id: string | null;
  is_active: boolean;
}

/** The user's currently active Spotify Connect device, or null. */
export async function findActiveDevice(c: SpotifyClient): Promise<{ id: string } | null> {
  const { data } = await c.request<{ devices?: Device[] } | null>("GET", "/me/player/devices");
  const d = (data?.devices ?? []).find((x) => x.is_active && typeof x.id === "string" && x.id);
  return d?.id ? { id: d.id } : null;
}

/**
 * Shuffle off, then start the playlist as a context on the device (ADR-0022).
 * Never uses a `uris` list: it returns 204 but plays nothing on Android (phase 1 research).
 */
export async function startPlaylistPlayback(
  c: SpotifyClient,
  input: { deviceId: string; playlistId: string },
): Promise<void> {
  const device = encodeURIComponent(input.deviceId);
  await c.request("PUT", `/me/player/shuffle?state=false&device_id=${device}`);
  await c.request("PUT", `/me/player/play?device_id=${device}`, {
    context_uri: `spotify:playlist:${input.playlistId}`,
  });
}

/** Whether something is actually playing; a 204 from play proves nothing (ADR-0022). */
export async function isPlaying(c: SpotifyClient): Promise<boolean> {
  const { data } = await c.request<{ is_playing?: boolean } | null>(
    "GET",
    "/me/player/currently-playing",
  );
  return data?.is_playing === true;
}
