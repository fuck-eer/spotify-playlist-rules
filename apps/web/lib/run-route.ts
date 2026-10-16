import type { SpotifyClient } from "@rulemix/spotify";
import { after, type NextRequest } from "next/server";
import type postgres from "postgres";
import { requireRequestUser } from "./auth/require-user";
import { getSql } from "./db/client";
import { getMix } from "./db/mixes-repo";
import { failStaleRuns, startRun, type RunKind } from "./db/save-runs-repo";
import { HttpError, jsonError } from "./http";
import { spotifyForUser } from "./spotify-for-user";

type Perform = (
  sql: postgres.Sql,
  userId: string,
  mixId: string,
  runId: string,
  client: SpotifyClient,
) => Promise<void>;

/** Starts a Save or Play run in after() and returns 202 { runId }; 409 { runId } if one is running (ADR-0024). */
export async function startRunResponse(
  req: NextRequest,
  params: Promise<{ id: string }>,
  kind: RunKind,
  perform: Perform,
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    if (!(await getMix(sql, user.id, id))) {
      throw new HttpError(404, "not_found", "That mix doesn't exist.");
    }
    await failStaleRuns(sql, user.id, id);
    const started = await startRun(sql, user.id, id, kind);
    if (!started.ok && started.reason === "in_progress") {
      return Response.json(
        {
          error: { code: "save_in_progress", message: "This mix is already being written." },
          runId: started.runId,
        },
        { status: 409 },
      );
    }
    if (!started.ok) throw new HttpError(404, "not_found", "That mix doesn't exist.");
    const run = started.run;
    after(() => perform(sql, user.id, id, run.id, spotifyForUser(sql, user.id)));
    return Response.json({ runId: run.id }, { status: 202 });
  } catch (e) {
    return jsonError(e);
  }
}
