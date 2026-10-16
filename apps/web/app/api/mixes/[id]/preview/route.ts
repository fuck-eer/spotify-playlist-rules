import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { jsonError } from "@/lib/http";
import { computePreview } from "@/lib/preview";
import { spotifyForUser } from "@/lib/spotify-for-user";

/** Regenerate endpoint: computed fresh on every call, never writes to Spotify (ADR-0013). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    return Response.json(await computePreview(sql, user.id, id, spotifyForUser(sql, user.id)), {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return jsonError(e);
  }
}
