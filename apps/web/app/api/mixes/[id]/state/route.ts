import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { jsonError } from "@/lib/http";
import { getMixState } from "@/lib/mix-state";
import { spotifyForUser } from "@/lib/spotify-for-user";

/** Mix state for local graph building; prunes songs deleted from the Source. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    return Response.json(await getMixState(sql, user.id, id, spotifyForUser(sql, user.id)), {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return jsonError(e);
  }
}
