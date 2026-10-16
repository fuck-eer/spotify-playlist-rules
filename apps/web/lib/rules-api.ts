import type { NextRequest } from "next/server";
import type { RulePatch } from "./db/rules-repo";
import { HttpError } from "./http";
import type { SessionUser } from "./auth/session";
import { userFromRequest } from "./auth/session";
import { getSql } from "./db/client";

/** Session user for a route handler, or HttpError(401). */
export async function requireRequestUser(req: NextRequest): Promise<SessionUser> {
  const u = await userFromRequest(getSql(), req);
  if (!u) throw new HttpError(401, "unauthorized", "Please sign in.");
  return u;
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    throw new HttpError(400, "invalid_rule", "That rule isn't valid.");
  }
}

/** Drops undefined keys (exactOptionalPropertyTypes). */
export function cleanPatch(p: {
  kind?: RulePatch["kind"] | undefined;
  n?: number | null | undefined;
  pinned?: boolean | undefined;
  archived?: boolean | undefined;
}): RulePatch {
  const out: RulePatch = {};
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.n !== undefined) out.n = p.n;
  if (p.pinned !== undefined) out.pinned = p.pinned;
  if (p.archived !== undefined) out.archived = p.archived;
  return out;
}

export function usedInMessage(n: number): string {
  return `Used in ${n} ${n === 1 ? "mix" : "mixes"}`;
}
