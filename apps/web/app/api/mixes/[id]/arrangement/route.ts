import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRequestUser } from "@/lib/auth/require-user";
import { putArrangement } from "@/lib/db/arrangement-repo";
import { getSql } from "@/lib/db/client";
import { env } from "@/lib/env";
import { HttpError, jsonError } from "@/lib/http";
import { getMixState } from "@/lib/mix-state";
import { spotifyForUser } from "@/lib/spotify-for-user";

const Uri = z.string().regex(/^spotify:track:[A-Za-z0-9]+$/);

function bodySchema() {
  const max = env().MAX_SOURCE_TRACKS;
  return z
    .object({
      version: z.number().int().min(0),
      manualOrder: z.array(Uri).max(max).nullable(),
      bench: z.array(Uri).max(max),
      rules: z.array(
        z
          .object({
            id: z.string().uuid(),
            removedPlays: z.number().int().min(0).max(9),
            deletedCopies: z.array(z.number().int().min(0).max(max)).max(max),
          })
          .strict(),
      ),
    })
    .strict();
}

/** Saves Manual order, Bench and deleted copies; stale version → 409 with the current state. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new HttpError(400, "invalid_body", "That request wasn't valid.");
    }
    const parsed = bodySchema().safeParse(raw);
    if (!parsed.success)
      throw new HttpError(422, "invalid_request", "That arrangement isn't valid.");
    const body = parsed.data;
    const r = await putArrangement(sql, user.id, id, body);
    if (r.ok) return Response.json({ version: r.version });
    if (r.code === "not_found") throw new HttpError(404, "not_found", "That mix doesn't exist.");
    if (r.code === "unknown_rule") {
      throw new HttpError(422, "invalid_request", "A rule doesn't belong to this mix.");
    }
    const state = await getMixState(sql, user.id, id, spotifyForUser(sql, user.id));
    return Response.json(
      { error: { code: "stale_version", message: "Updated from another device." }, state },
      { status: 409 },
    );
  } catch (e) {
    return jsonError(e);
  }
}
