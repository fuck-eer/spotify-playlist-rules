import { createClient, exchangeCode, getMe, type Me, type TokenSet } from "@rulemix/spotify";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { bearerToken, createSession, destroySession, SESSION_TTL_DAYS } from "@/lib/auth/session";
import { upsertSpotifyUser } from "@/lib/auth/upsert-user";
import { getSql } from "@/lib/db/client";
import { env } from "@/lib/env";
import { HttpError, jsonError } from "@/lib/http";
import { spotifyConfig } from "@/lib/spotify-config";

const Body = z.object({ code: z.string().min(1), redirectUri: z.string().min(1) }).strict();

/** Android sign-in (ADR-0034): exchange a Spotify code for a rulemix Bearer token. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new HttpError(400, "invalid_body", "That request wasn't valid.");
    }
    const parsed = Body.safeParse(raw);
    if (!parsed.success || parsed.data.redirectUri !== env().MOBILE_REDIRECT_URI) {
      throw new HttpError(400, "invalid_body", "That request wasn't valid.");
    }
    const cfg = spotifyConfig();
    let tokens: TokenSet;
    let me: Me;
    try {
      tokens = await exchangeCode(cfg, {
        code: parsed.data.code,
        redirectUri: parsed.data.redirectUri,
      });
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
      console.error(
        "[mobile/session] Spotify sign-in failed",
        e instanceof Error ? e.name : typeof e,
      );
      throw new HttpError(401, "spotify_rejected", "Spotify sign-in failed. Try again.");
    }
    const sql = getSql();
    await upsertSpotifyUser(sql, tokens, me);
    const token = await createSession(sql, me.id, "mobile");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
    return Response.json({ token, expiresAt, user: { id: me.id, displayName: me.displayName } });
  } catch (e) {
    return jsonError(e);
  }
}

/** Android sign-out: destroys the Bearer session. */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, "unauthorized", "Please sign in.");
    await destroySession(getSql(), token);
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}
