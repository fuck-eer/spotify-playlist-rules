import {
  PLAYER_PLAYLIST_DESCRIPTION,
  PLAYER_PLAYLIST_NAME,
  findActiveDevice,
  hasPlaybackScopes,
  isPlaying,
  startPlaylistPlayback,
  writeTarget,
  type SpotifyClient,
} from "@rulemix/spotify";
import type postgres from "postgres";
import { finishRun, updateRun, type PlaybackOutcome } from "./db/save-runs-repo";
import { getPlayerState, setPlayerPlaylistId } from "./db/users-repo";
import { progressWriter, readAndBuild, userMessage } from "./save";

/** Wait between starting playback and checking currently-playing (ADR-0022). */
export const PLAY_CHECK_DELAY_MS = 1500;

/** Best-effort remote play: any Spotify error here means "not started", never a failed run. */
async function startRemote(
  client: SpotifyClient,
  scopes: string,
  playlistId: string,
  checkDelayMs: number,
  ctx: { userId: string; mixId: string; runId: string },
): Promise<PlaybackOutcome> {
  if (!hasPlaybackScopes(scopes)) return "needs_scopes";
  try {
    const device = await findActiveDevice(client);
    if (!device) return "no_device";
    await startPlaylistPlayback(client, { deviceId: device.id, playlistId });
    if (checkDelayMs > 0) await new Promise((r) => setTimeout(r, checkDelayMs));
    return (await isPlaying(client)) ? "started" : "not_started";
  } catch (e) {
    console.error("[play] remote play failed", {
      ...ctx,
      error: e instanceof Error ? e.name : typeof e,
    });
    return "not_started";
  }
}

/** Play: read Source → build → overwrite the Player playlist → start it if possible (ADR-0021/0022). */
export async function performPlay(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
  client: SpotifyClient,
  opts: { checkDelayMs?: number } = {},
): Promise<void> {
  const progress = progressWriter(sql, userId, runId);
  try {
    const player = await getPlayerState(sql, userId);
    if (!player) throw new Error("user missing");
    const { uris } = await readAndBuild(sql, userId, mixId, runId, client, progress);

    await updateRun(sql, userId, runId, { phase: "writing", done: 0, total: uris.length });
    const result = await writeTarget(client, {
      targetPlaylistId: player.playerPlaylistId,
      defaultName: PLAYER_PLAYLIST_NAME,
      description: PLAYER_PLAYLIST_DESCRIPTION,
      uris,
      onProgress: (done, total) => progress.push({ done, total }),
    });
    await progress.flush();
    if (result.playlistId !== player.playerPlaylistId) {
      await setPlayerPlaylistId(sql, userId, result.playlistId);
    }

    const playback = await startRemote(
      client,
      player.scopes,
      result.playlistId,
      opts.checkDelayMs ?? PLAY_CHECK_DELAY_MS,
      { userId, mixId, runId },
    );
    await updateRun(sql, userId, runId, {
      recreated: result.recreated,
      tracksWritten: result.tracksWritten,
      retries429: client.stats.retries429,
      playlistId: result.playlistId,
      playback,
    });
    await finishRun(sql, userId, runId, { status: "succeeded" });
  } catch (e) {
    await progress.flush();
    console.error("[play] failed", {
      userId,
      mixId,
      runId,
      error: e instanceof Error ? e.name : typeof e,
    });
    await finishRun(sql, userId, runId, { status: "failed", error: userMessage(e) });
  }
}
