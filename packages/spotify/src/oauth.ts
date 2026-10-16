import { SCOPES, fetchOf, trimSlash, type SpotifyConfig } from "./config.js";
import { SpotifyAuthError, SpotifyHttpError } from "./errors.js";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
}

export function buildAuthorizeUrl(
  cfg: SpotifyConfig,
  p: { state: string; challenge: string },
): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    state: p.state,
    code_challenge_method: "S256",
    code_challenge: p.challenge,
    scope: SCOPES.join(" "),
  });
  return `${trimSlash(cfg.accountsBaseUrl)}/authorize?${q.toString()}`;
}

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
}

async function postToken(
  cfg: SpotifyConfig,
  form: Record<string, string>,
  fallbackRefresh: string | null,
): Promise<TokenSet> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetchOf(cfg)(`${trimSlash(cfg.accountsBaseUrl)}/api/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  let body: TokenResponse = {};
  try {
    body = text ? (JSON.parse(text) as TokenResponse) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    // Never include tokens in messages; the body only carries error codes.
    if (body.error === "invalid_grant" || res.status === 401) {
      throw new SpotifyAuthError("Spotify rejected the grant", res.status, body);
    }
    throw new SpotifyHttpError(`Spotify token endpoint returned ${res.status}`, res.status, body);
  }
  const refresh = typeof body.refresh_token === "string" ? body.refresh_token : fallbackRefresh;
  if (typeof body.access_token !== "string" || refresh === null) {
    throw new SpotifyHttpError("Spotify token response was incomplete", res.status, null);
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    refreshToken: refresh,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: typeof body.scope === "string" ? body.scope : "",
  };
}

export function exchangeCode(
  cfg: SpotifyConfig,
  p: { code: string; verifier?: string; redirectUri?: string },
): Promise<TokenSet> {
  const form: Record<string, string> = {
    grant_type: "authorization_code",
    code: p.code,
    redirect_uri: p.redirectUri ?? cfg.redirectUri,
  };
  // Mobile (ADR-0034) uses the Spotify auth library's code flow without PKCE.
  if (p.verifier !== undefined) form.code_verifier = p.verifier;
  return postToken(cfg, form, null);
}

export function refreshAccessToken(cfg: SpotifyConfig, refreshToken: string): Promise<TokenSet> {
  return postToken(cfg, { grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
}
