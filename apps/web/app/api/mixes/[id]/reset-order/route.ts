import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { clearManualOrder } from "@/lib/db/arrangement-repo";
import { getSql } from "@/lib/db/client";
import { HttpError, jsonError } from "@/lib/http";

/** Reset to rule order: clears the Manual order, keeps the Seed, Bench and deletions. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const r = await clearManualOrder(sql, user.id, (await params).id, null);
    if (!r) throw new HttpError(404, "not_found", "That mix doesn't exist.");
    return Response.json(r);
  } catch (e) {
    return jsonError(e);
  }
}
