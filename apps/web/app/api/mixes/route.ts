import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { createMix, listMixes, randomSeed } from "@/lib/db/mixes-repo";
import { jsonError } from "@/lib/http";
import { CreateMixBody, normalizeSource, parseBody } from "@/lib/mix-input";
import { resolveAllowedSource } from "@/lib/sources";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    return Response.json({ mixes: await listMixes(sql, user.id) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const body = await parseBody(req, CreateMixBody);
    const source = await resolveAllowedSource(sql, user.id, normalizeSource(body.source));
    const mix = await createMix(sql, user.id, { name: body.name, source }, randomSeed());
    return Response.json({ mix }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
