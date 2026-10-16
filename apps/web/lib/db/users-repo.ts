import type postgres from "postgres";

export interface PlayerState {
  playerPlaylistId: string | null;
  scopes: string;
}

export async function getPlayerState(
  sql: postgres.Sql,
  userId: string,
): Promise<PlayerState | null> {
  const [r] = await sql<{ player_playlist_id: string | null; scopes: string }[]>`
    select player_playlist_id, scopes from users where id = ${userId}`;
  return r ? { playerPlaylistId: r.player_playlist_id, scopes: r.scopes } : null;
}

export async function setPlayerPlaylistId(
  sql: postgres.Sql,
  userId: string,
  playlistId: string,
): Promise<void> {
  await sql`update users set player_playlist_id = ${playlistId} where id = ${userId}`;
}
