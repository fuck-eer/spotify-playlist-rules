import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { z } from "zod";
import { removeMixRule, updateMixRule } from "@/lib/db/mix-rules-repo";
import { HttpError, jsonError } from "@/lib/http";
import { parseBody } from "@/lib/mix-input";

const PatchBody = z.object({ ruleId: z.string().min(1) });

/** Edits the rule in place: same id and priority position (its deletions are cleared). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mixRuleId: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id, mixRuleId } = await params;
    const body = await parseBody(req, PatchBody);
    const res = await updateMixRule(sql, user.id, id, mixRuleId, body.ruleId);
    if (!res.ok) {
      if (res.code === "archived")
        throw new HttpError(422, "rule_archived", "That rule is archived. Restore it first.");
      throw new HttpError(404, "not_found", "That rule isn't in this mix.");
    }
    return Response.json({ rule: res.row });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mixRuleId: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { id, mixRuleId } = await params;
    if (!(await removeMixRule(sql, user.id, id, mixRuleId))) {
      throw new HttpError(404, "not_found", "That rule isn't in this mix.");
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}
