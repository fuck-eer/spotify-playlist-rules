import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { getMix } from "@/lib/db/mixes-repo";
import { HttpError, jsonError } from "@/lib/http";
import { readSourceTracks, uniqueAvailable } from "@/lib/source-tracks";
import { spotifyForUser } from "@/lib/spotify-for-user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const mix = await getMix(sql, user.id, (await params).id);
    if (!mix) throw new HttpError(404, "not_found", "That mix doesn't exist.");
    const items = await readSourceTracks(sql, spotifyForUser(sql, user.id), mix.source);
    return Response.json({ songs: uniqueAvailable(items) });
  } catch (e) {
    return jsonError(e);
  }
}
