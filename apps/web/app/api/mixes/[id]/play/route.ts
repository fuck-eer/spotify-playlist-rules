import type { NextRequest } from "next/server";
import { performPlay } from "@/lib/play";
import { startRunResponse } from "@/lib/run-route";

/** Play: overwrites the Player playlist and starts it if possible (ADR-0021, ADR-0022). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return startRunResponse(req, params, "play", (sql, userId, mixId, runId, client) =>
    performPlay(sql, userId, mixId, runId, client),
  );
}
