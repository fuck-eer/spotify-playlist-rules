import { env } from "../env";

export const OAUTH_COOKIE = "rulemix_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth";

export function secureCookies(): boolean {
  return env().APP_URL.startsWith("https");
}

export function appUrl(path: string): URL {
  return new URL(path, env().APP_URL);
}
