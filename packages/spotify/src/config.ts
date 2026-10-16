/** Spec A8: no public-playlist scope, targets are private. */
export const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "user-library-read",
] as const;

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function fetchOf(cfg: SpotifyConfig): typeof fetch {
  return cfg.fetch ?? fetch;
}

export function sleepOf(cfg: SpotifyConfig): (ms: number) => Promise<void> {
  return cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
}

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
