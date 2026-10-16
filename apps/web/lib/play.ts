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
/** Max wait for the per-user Player playlist lock before the run fails cleanly. */
export const PLAYER_LOCK_TIMEOUT_MS = 60_000;

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
  opts: { checkDelayMs?: number; lockTimeoutMs?: number } = {},
): Promise<void> {
  const progress = progressWriter(sql, userId, runId);
  try {
    const { uris } = await readAndBuild(sql, userId, mixId, runId, client, progress);

    await updateRun(sql, userId, runId, { phase: "writing", done: 0, total: uris.length });
    // Per-user lock: concurrent Plays can't create two Player playlists, and their
    // writes to the one playlist don't interleave (ADR-0021).
    const lockTimeout = `${Math.max(1, Math.trunc(opts.lockTimeoutMs ?? PLAYER_LOCK_TIMEOUT_MS))}ms`;
    const { player, result } = await sql.begin(async (tx) => {
      await tx`select set_config('lock_timeout', ${lockTimeout}, true)`;
      await tx`select pg_advisory_xact_lock(hashtextextended(${`player:${userId}`}, 0))`;
      const state = await getPlayerState(tx, userId);
      if (!state) throw new Error("user missing");
      const written = await writeTarget(client, {
        targetPlaylistId: state.playerPlaylistId,
        defaultName: PLAYER_PLAYLIST_NAME,
        description: PLAYER_PLAYLIST_DESCRIPTION,
        uris,
        onProgress: (done, total) => progress.push({ done, total }),
      });
      if (written.playlistId !== state.playerPlaylistId) {
        await setPlayerPlaylistId(tx, userId, written.playlistId);
      }
      return { player: state, result: written };
    });
    await progress.flush();

    const stillRunning = await updateRun(sql, userId, runId, {
      recreated: result.recreated,
      tracksWritten: result.tracksWritten,
      playlistId: result.playlistId,
    });
    if (!stillRunning) {
      // Marked stale (or otherwise finished) while waiting or writing: the user was told it
      // failed, so don't start playback behind their back.
      console.error("[play] run no longer running; skipping remote play", { userId, mixId, runId });
      return;
    }

    const playback = await startRemote(
      client,
      player.scopes,
      result.playlistId,
      opts.checkDelayMs ?? PLAY_CHECK_DELAY_MS,
      { userId, mixId, runId },
    );
    await updateRun(sql, userId, runId, { retries429: client.stats.retries429, playback });
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
