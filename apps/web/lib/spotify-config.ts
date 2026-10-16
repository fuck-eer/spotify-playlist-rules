import type { SpotifyConfig } from "@rulemix/spotify";
import { env } from "./env";

export function spotifyConfig(): SpotifyConfig {
  const e = env();
  return {
    clientId: e.SPOTIFY_CLIENT_ID,
    clientSecret: e.SPOTIFY_CLIENT_SECRET,
    redirectUri: e.SPOTIFY_REDIRECT_URI,
    accountsBaseUrl: e.SPOTIFY_ACCOUNTS_BASE_URL,
    apiBaseUrl: e.SPOTIFY_API_BASE_URL,
  };
}
