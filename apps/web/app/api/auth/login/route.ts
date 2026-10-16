import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl, createPkcePair } from "@rulemix/spotify";
import { NextResponse } from "next/server";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, secureCookies } from "@/lib/auth/cookies";
import { sign } from "@/lib/crypto";
import { spotifyConfig } from "@/lib/spotify-config";

export function GET(): NextResponse {
  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(buildAuthorizeUrl(spotifyConfig(), { state, challenge }), 302);
  res.cookies.set(OAUTH_COOKIE, sign(JSON.stringify({ state, verifier })), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    maxAge: 600,
    path: OAUTH_COOKIE_PATH,
  });
  return res;
}
