import type { NextRequest } from "next/server";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { removeMixRule } from "@/lib/db/mix-rules-repo";
import { HttpError, jsonError } from "@/lib/http";

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
