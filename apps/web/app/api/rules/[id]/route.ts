import type { NextRequest } from "next/server";
import { getSql } from "@/lib/db/client";
import { deleteRule, getRule, updateRule } from "@/lib/db/rules-repo";
import { HttpError, jsonError } from "@/lib/http";
import { cleanPatch, readJson, requireRequestUser, usedInMessage } from "@/lib/rules-api";
import { mergedRuleIsValid, RulePatchSchema } from "@/lib/validation";

interface Ctx {
  params: Promise<{ id: string }>;
}

const notFound = () => new HttpError(404, "not_found", "That rule doesn't exist.");

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const user = await requireRequestUser(req);
    const rule = await getRule(getSql(), user.id, (await params).id);
    if (!rule) throw notFound();
    return Response.json({ rule });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const user = await requireRequestUser(req);
    const { id } = await params;
    const parsed = RulePatchSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_rule", "That rule isn't valid.");
    const sql = getSql();
    const current = await getRule(sql, user.id, id);
    if (!current) throw notFound();
    if (!mergedRuleIsValid(current, parsed.data))
      throw new HttpError(400, "invalid_rule", "That rule isn't valid.");
    const rule = await updateRule(sql, user.id, id, cleanPatch(parsed.data));
    if (!rule) throw notFound();
    return Response.json({ rule });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx): Promise<Response> {
  try {
    const user = await requireRequestUser(req);
    const res = await deleteRule(getSql(), user.id, (await params).id);
    if (!res) throw notFound();
    if (!res.ok)
      return Response.json(
        {
          error: { code: "rule_in_use", message: usedInMessage(res.usedInMixes) },
          usedInMixes: res.usedInMixes,
        },
        { status: 409 },
      );
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}
