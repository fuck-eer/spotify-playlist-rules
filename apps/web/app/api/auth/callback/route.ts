import { createClient, exchangeCode, getMe, type TokenSet } from "@rulemix/spotify";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl, OAUTH_COOKIE, OAUTH_COOKIE_PATH, secureCookies } from "@/lib/auth/cookies";
import { createSession, SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth/session";
import { upsertSpotifyUser } from "@/lib/auth/upsert-user";
import { verifySigned } from "@/lib/crypto";
import { getSql } from "@/lib/db/client";
import { spotifyConfig } from "@/lib/spotify-config";

interface OAuthState {
  state: string;
  verifier: string;
}

function readOAuthCookie(raw: string | undefined): OAuthState | null {
  const v = raw ? verifySigned(raw) : null;
  if (!v) return null;
  try {
    const p = JSON.parse(v) as Partial<OAuthState>;
    return typeof p.state === "string" && typeof p.verifier === "string"
      ? { state: p.state, verifier: p.verifier }
      : null;
  } catch {
    return null;
  }
}

function back(error: "state" | "denied"): NextResponse {
  const res = NextResponse.redirect(appUrl(`/?error=${error}`), 302);
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("denied");
  const saved = readOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const code = q.get("code");
  if (!saved || saved.state !== q.get("state") || !code) return back("state");

  const cfg = spotifyConfig();
  let tokens: TokenSet;
  let me: Awaited<ReturnType<typeof getMe>>;
  try {
    tokens = await exchangeCode(cfg, { code, verifier: saved.verifier });
    let current = tokens;
    me = await getMe(
      createClient(cfg, {
        get: () => Promise.resolve(current),
        set: (t) => {
          current = t;
          return Promise.resolve();
        },
      }),
    );
  } catch (e) {
    console.error("[auth/callback] Spotify sign-in failed", e instanceof Error ? e.name : typeof e);
    return back("denied");
  }

  const sql = getSql();
  await upsertSpotifyUser(sql, tokens, me);
  const raw = await createSession(sql, me.id);

  const res = NextResponse.redirect(appUrl("/mixes"), 302);
  res.cookies.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}
