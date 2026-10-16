import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { deleteMix, getMix, updateMix, type MixPatch } from "@/lib/db/mixes-repo";
import { HttpError, jsonError } from "@/lib/http";
import { normalizeSource, parseBody, PatchMixBody } from "@/lib/mix-input";
import { resolveAllowedSource } from "@/lib/sources";

interface Ctx {
  params: Promise<{ id: string }>;
}

const notFound = () => new HttpError(404, "not_found", "That mix doesn't exist.");

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const mix = await getMix(sql, user.id, (await params).id);
    if (!mix) throw notFound();
    return Response.json({ mix });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    const body = await parseBody(req, PatchMixBody);
    const current = await getMix(sql, user.id, id);
    if (!current) throw notFound();
    const patch: MixPatch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.keepSourceOrder !== undefined) patch.keepSourceOrder = body.keepSourceOrder;
    if (body.source) {
      const next = normalizeSource(body.source);
      if (next.type !== current.source.type || next.id !== current.source.id) {
        patch.source = await resolveAllowedSource(sql, user.id, next);
      }
    }
    const mix = await updateMix(sql, user.id, id, patch);
    if (!mix) throw notFound();
    return Response.json({ mix });
  } catch (e) {
    return jsonError(e);
  }
}

/** Deletes the Mix only; its Target playlist in Spotify is left alone. */
export async function DELETE(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    if (!(await deleteMix(sql, user.id, (await params).id))) throw notFound();
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}
