import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { getRun } from "@/lib/db/save-runs-repo";
import { HttpError, jsonError } from "@/lib/http";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id, runId } = await params;
    const run = await getRun(sql, user.id, id, runId);
    if (!run) throw new HttpError(404, "not_found", "That save doesn't exist.");
    return Response.json({ run }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
