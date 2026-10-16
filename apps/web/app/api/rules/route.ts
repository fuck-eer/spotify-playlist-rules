import type { NextRequest } from "next/server";
import { getSql } from "@/lib/db/client";
import { createRule, listRules } from "@/lib/db/rules-repo";
import { HttpError, jsonError } from "@/lib/http";
import { readJson, requireRequestUser } from "@/lib/rules-api";
import { RuleInputSchema } from "@/lib/validation";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const user = await requireRequestUser(req);
    return Response.json({ rules: await listRules(getSql(), user.id) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const user = await requireRequestUser(req);
    const parsed = RuleInputSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_rule", "That rule isn't valid.");
    const rule = await createRule(getSql(), user.id, parsed.data);
    return Response.json({ rule }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
