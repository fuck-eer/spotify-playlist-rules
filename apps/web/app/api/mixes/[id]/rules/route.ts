import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { addMixRule, listMixRules } from "@/lib/db/mix-rules-repo";
import { getMix } from "@/lib/db/mixes-repo";
import { env } from "@/lib/env";
import { HttpError, jsonError } from "@/lib/http";
import { parseBody } from "@/lib/mix-input";
import { readSourceTracks } from "@/lib/source-tracks";
import { spotifyForUser } from "@/lib/spotify-for-user";

interface Ctx {
  params: Promise<{ id: string }>;
}

const AddBody = z.object({
  ruleId: z.string().min(1),
  trackUri: z.string().startsWith("spotify:track:"),
});
const notFound = () => new HttpError(404, "not_found", "That mix doesn't exist.");

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    if (!(await getMix(sql, user.id, id))) throw notFound();
    return Response.json({
      rules: await listMixRules(sql, user.id, id),
      maxRules: env().MAX_RULES_PER_MIX,
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id } = await params;
    const body = await parseBody(req, AddBody);
    const mix = await getMix(sql, user.id, id);
    if (!mix) throw notFound();
    const max = env().MAX_RULES_PER_MIX;
    if (mix.ruleCount >= max) throw new HttpError(409, "rule_limit", `Up to ${max} rules per mix.`);
    const tracks = await readSourceTracks(sql, spotifyForUser(sql, user.id), mix.source);
    if (!tracks.some((t) => t?.uri === body.trackUri)) {
      throw new HttpError(422, "song_not_in_source", "That song isn't in this mix's source.");
    }
    const res = await addMixRule(sql, user.id, id, body, max);
    if (!res.ok) {
      if (res.code === "limit")
        throw new HttpError(409, "rule_limit", `Up to ${max} rules per mix.`);
      if (res.code === "archived")
        throw new HttpError(422, "rule_archived", "That rule is archived. Restore it first.");
      throw new HttpError(404, "not_found", "That rule or mix doesn't exist.");
    }
    return Response.json({ rule: res.row }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
