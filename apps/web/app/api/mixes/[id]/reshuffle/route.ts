import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { randomSeed, updateMix } from "@/lib/db/mixes-repo";
import { HttpError, jsonError } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const mix = await updateMix(sql, user.id, (await params).id, { shuffleSeed: randomSeed() });
    if (!mix) throw new HttpError(404, "not_found", "That mix doesn't exist.");
    return Response.json({ seed: mix.shuffleSeed });
  } catch (e) {
    return jsonError(e);
  }
}
