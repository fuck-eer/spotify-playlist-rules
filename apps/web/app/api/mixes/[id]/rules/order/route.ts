import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRequestUser } from "@/lib/auth/require-user";
import { getSql } from "@/lib/db/client";
import { reorderMixRules } from "@/lib/db/mix-rules-repo";
import { HttpError, jsonError } from "@/lib/http";
import { parseBody } from "@/lib/mix-input";

const OrderBody = z.object({ ids: z.array(z.string()) });

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const sql = getSql();
    const user = await requireRequestUser(sql, req);
    const { ids } = await parseBody(req, OrderBody);
    if (!(await reorderMixRules(sql, user.id, (await params).id, ids))) {
      throw new HttpError(400, "bad_order", "The rules changed. Reload and try again.");
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}
