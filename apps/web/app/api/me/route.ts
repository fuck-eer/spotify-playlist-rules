import type { NextRequest } from "next/server";
import { userFromRequest } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { HttpError, jsonError } from "@/lib/http";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const user = await userFromRequest(getSql(), req);
    if (!user) throw new HttpError(401, "unauthorized", "Please sign in.");
    return Response.json({ id: user.id, displayName: user.displayName });
  } catch (e) {
    return jsonError(e);
  }
}
