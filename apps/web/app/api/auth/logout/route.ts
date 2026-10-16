import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/auth/cookies";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await destroySession(getSql(), req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(appUrl("/"), 302);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
