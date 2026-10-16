import { createClient, type SpotifyClient } from "@rulemix/spotify";
import type postgres from "postgres";
import { dbTokenStore } from "./auth/token-store";
import { spotifyConfig } from "./spotify-config";

export function spotifyForUser(sql: postgres.Sql, userId: string): SpotifyClient {
  return createClient(spotifyConfig(), dbTokenStore(sql, userId));
}
