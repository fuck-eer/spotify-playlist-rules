import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { jsonError } from "@/lib/http";
import { sourcesForUser } from "@/lib/sources";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    return Response.json(await sourcesForUser(sql, user.id));
  } catch (e) {
    return jsonError(e);
  }
}
