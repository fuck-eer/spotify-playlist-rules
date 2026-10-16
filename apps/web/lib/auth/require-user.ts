import type postgres from "postgres";
import { HttpError } from "../http";
import { userFromRequest, type SessionUser } from "./session";

export async function requireRequestUser(
  sql: postgres.Sql,
  req: { cookies: { get(name: string): { value: string } | undefined } },
): Promise<SessionUser> {
  const u = await userFromRequest(sql, req);
  if (!u) throw new HttpError(401, "unauthorized", "Please sign in.");
  return u;
}
