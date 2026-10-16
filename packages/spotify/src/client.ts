import { fetchOf, sleepOf, trimSlash, type SpotifyConfig } from "./config.js";
import {
  SpotifyAuthError,
  SpotifyForbiddenError,
  SpotifyHttpError,
  SpotifyNotFoundError,
  SpotifyRateLimitError,
} from "./errors.js";
import { refreshAccessToken, type TokenSet } from "./oauth.js";

export interface TokenStore {
  get(): Promise<TokenSet>;
  set(t: TokenSet): Promise<void>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface SpotifyClient {
  request<T>(method: HttpMethod, path: string, body?: unknown): Promise<{ status: number; data: T }>;
  readonly stats: { requests: number; retries429: number };
}

const REFRESH_SKEW_MS = 60_000;
const MAX_429_RETRIES = 5;

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createClient(cfg: SpotifyConfig, store: TokenStore): SpotifyClient {
  const stats = { requests: 0, retries429: 0 };
  const doFetch = fetchOf(cfg);
  const sleep = sleepOf(cfg);
  const base = trimSlash(cfg.apiBaseUrl);

  async function refresh(current: TokenSet): Promise<TokenSet> {
    const next = await refreshAccessToken(cfg, current.refreshToken);
    await store.set(next);
    return next;
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    let token = await store.get();
    if (token.expiresAt - Date.now() < REFRESH_SKEW_MS) token = await refresh(token);
    let refreshedOn401 = false;
    let retries = 0;
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

    for (;;) {
      const headers: Record<string, string> = { authorization: `Bearer ${token.accessToken}` };
      const init: RequestInit = { method, headers };
      if (body !== undefined) {
        headers["content-type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      stats.requests++;
      const res = await doFetch(url, init);
      const status = res.status;

      if (status === 401) {
        const errBody = await readBody(res);
        if (refreshedOn401) throw new SpotifyAuthError("Spotify rejected the access token", status, errBody);
        refreshedOn401 = true;
        token = await refresh(token);
        continue;
      }
      if (status === 429) {
        const errBody = await readBody(res);
        if (retries >= MAX_429_RETRIES) {
          throw new SpotifyRateLimitError("Spotify rate limit: retries exhausted", status, errBody);
        }
        const after = Number(res.headers.get("retry-after"));
        retries++;
        stats.retries429++;
        await sleep((Number.isFinite(after) && after > 0 ? after : 1) * 1000);
        continue;
      }
      const data = status === 204 ? null : await readBody(res);
      if (status === 403) throw new SpotifyForbiddenError(`Spotify ${method} ${path}: 403`, status, data);
      if (status === 404) throw new SpotifyNotFoundError(`Spotify ${method} ${path}: 404`, status, data);
      if (status >= 400) throw new SpotifyHttpError(`Spotify ${method} ${path}: ${status}`, status, data);
      return { status, data: data as T };
    }
  }

  return { request, stats };
}
