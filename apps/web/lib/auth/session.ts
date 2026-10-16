import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type postgres from "postgres";
import { getSql } from "../db/client";
import { HttpError } from "../http";

export const SESSION_COOKIE = "rulemix_session";
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  displayName: string | null;
}

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Creates a session row and returns the raw cookie/Bearer value (only its sha256 is stored). */
export async function createSession(
  sql: postgres.Sql,
  userId: string,
  kind: "web" | "mobile" = "web",
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (id_hash, user_id, expires_at, kind)
    values (${hash(raw)}, ${userId}, now() + make_interval(days => ${SESSION_TTL_DAYS}), ${kind})`;
  return raw;
}

export interface RequestLike {
  cookies: { get(name: string): { value: string } | undefined };
  headers?: { get(name: string): string | null };
}

/** The Bearer token from `Authorization: Bearer <token>` (ADR-0034), if any. */
export function bearerToken(req: RequestLike): string | undefined {
  const h = req.headers?.get("authorization");
  const m = h ? /^Bearer\s+(\S+)$/i.exec(h) : null;
  return m?.[1];
}

export async function getSessionUser(
  sql: postgres.Sql,
  rawCookie: string | undefined,
): Promise<SessionUser | null> {
  if (!rawCookie) return null;
  const [row] = await sql<{ id: string; display_name: string | null }[]>`
    select u.id, u.display_name from sessions s join users u on u.id = s.user_id
    where s.id_hash = ${hash(rawCookie)} and s.expires_at > now()`;
  return row ? { id: row.id, displayName: row.display_name } : null;
}

export async function destroySession(
  sql: postgres.Sql,
  rawCookie: string | undefined,
): Promise<void> {
  if (!rawCookie) return;
  await sql`delete from sessions where id_hash = ${hash(rawCookie)}`;
}

async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getSessionUser(getSql(), jar.get(SESSION_COOKIE)?.value);
}

/** For route handlers: throws HttpError(401) without a valid session. */
export async function requireUserApi(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "unauthorized", "Please sign in.");
  return u;
}

/** For pages: redirects to the sign-in page without a valid session. */
export async function requireUserPage(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/");
  return u;
}

/** Signed-in user or null, for pages that render either way. */
export async function optionalUser(): Promise<SessionUser | null> {
  return currentUser();
}

/** Session user from a request: Bearer token first (Android, ADR-0034), then the cookie. */
export async function userFromRequest(
  sql: postgres.Sql,
  req: RequestLike,
): Promise<SessionUser | null> {
  const bearer = bearerToken(req);
  if (bearer) return getSessionUser(sql, bearer);
  return getSessionUser(sql, req.cookies.get(SESSION_COOKIE)?.value);
}
