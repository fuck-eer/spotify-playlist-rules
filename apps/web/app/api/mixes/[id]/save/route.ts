import { after, type NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { getMix } from "@/lib/db/mixes-repo";
import { failStaleRuns, startRun } from "@/lib/db/save-runs-repo";
import { HttpError, jsonError } from "@/lib/http";
import { performSave } from "@/lib/save";
import { spotifyForUser } from "@/lib/spotify-for-user";

/** Save to Spotify: the only path that writes to Spotify (ADR-0013). Progress is polled (A5). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    if (!(await getMix(sql, user.id, id))) {
      throw new HttpError(404, "not_found", "That mix doesn't exist.");
    }
    await failStaleRuns(sql, user.id, id);
    const started = await startRun(sql, user.id, id);
    if (!started.ok && started.reason === "in_progress") {
      return Response.json(
        {
          error: { code: "save_in_progress", message: "A save is already running." },
          runId: started.runId,
        },
        { status: 409 },
      );
    }
    if (!started.ok) throw new HttpError(404, "not_found", "That mix doesn't exist.");
    const run = started.run;
    after(() => performSave(sql, user.id, id, run.id, spotifyForUser(sql, user.id)));
    return Response.json({ runId: run.id }, { status: 202 });
  } catch (e) {
    return jsonError(e);
  }
}
