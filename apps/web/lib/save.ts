import { build, type BuildResult } from "@rulemix/rules-engine";
import { SpotifyAuthError, targetName, writeTarget, type SpotifyClient } from "@rulemix/spotify";
import type postgres from "postgres";
import { listMixRules } from "./db/mix-rules-repo";
import { getMix, updateMix, type MixRow } from "./db/mixes-repo";
import { finishRun, SAVE_FAILED, updateRun, type RunPatch } from "./db/save-runs-repo";
import { HttpError } from "./http";
import { readSourceTracks } from "./source-tracks";

export { SAVE_FAILED };
export const SAVE_REAUTH = "Spotify access expired. Sign in again.";

export function userMessage(e: unknown): string {
  if (e instanceof SpotifyAuthError) return SAVE_REAUTH;
  if (e instanceof HttpError && e.code === "source_too_large") return e.message;
  return SAVE_FAILED;
}

/** Serialises progress writes so the last update always lands last. */
export function progressWriter(sql: postgres.Sql, userId: string, runId: string) {
  let chain: Promise<void> = Promise.resolve();
  return {
    push(patch: RunPatch): void {
      chain = chain
        .then(async () => {
          await updateRun(sql, userId, runId, patch);
        })
        .catch((e: unknown) => {
          console.error("[save] progress update failed", {
            runId,
            e: e instanceof Error ? e.name : typeof e,
          });
        });
    },
    flush: () => chain,
  };
}

type Progress = ReturnType<typeof progressWriter>;

/** Shared by Save and Play: read the Mix's Source with progress, then run the engine. */
export async function readAndBuild(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
  client: SpotifyClient,
  progress: Progress,
): Promise<{ mix: MixRow; uris: BuildResult["uris"] }> {
  const mix = await getMix(sql, userId, mixId);
  if (!mix) throw new HttpError(404, "not_found", "That mix doesn't exist.");
  const rules = await listMixRules(sql, userId, mixId);

  await updateRun(sql, userId, runId, { phase: "reading", done: 0, total: 0 });
  const source = await readSourceTracks(sql, client, mix.source, (done, total) =>
    progress.push({ done, total }),
  );
  await progress.flush();

  const { uris } = build({
    source,
    rules: rules.map((r) => ({ kind: r.kind, n: r.n, uri: r.trackUri })),
    keepSourceOrder: mix.keepSourceOrder,
    seed: mix.shuffleSeed,
  });
  return { mix, uris };
}

/** Save to Spotify: read Source → build → write Target (ADR-0015/0016). Never renames in Spotify (A11). */
export async function performSave(
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
  client: SpotifyClient,
): Promise<void> {
  const progress = progressWriter(sql, userId, runId);
  try {
    const { mix, uris } = await readAndBuild(sql, userId, mixId, runId, client, progress);

    await updateRun(sql, userId, runId, { phase: "writing", done: 0, total: uris.length });
    const result = await writeTarget(client, {
      targetPlaylistId: mix.targetPlaylistId,
      defaultName: targetName(mix.name),
      uris,
      onProgress: (done, total) => progress.push({ done, total }),
    });
    await progress.flush();

    await updateMix(sql, userId, mixId, {
      targetPlaylistId: result.playlistId,
      lastSavedAt: new Date().toISOString(),
      lastSnapshotId: result.snapshotId,
    });
    await updateRun(sql, userId, runId, {
      recreated: result.recreated,
      tracksWritten: result.tracksWritten,
      retries429: client.stats.retries429,
      playlistId: result.playlistId,
    });
    await finishRun(sql, userId, runId, { status: "succeeded" });
  } catch (e) {
    await progress.flush();
    console.error("[save] failed", {
      userId,
      mixId,
      runId,
      error: e instanceof Error ? e.name : typeof e,
    });
    await finishRun(sql, userId, runId, { status: "failed", error: userMessage(e) });
  }
}
