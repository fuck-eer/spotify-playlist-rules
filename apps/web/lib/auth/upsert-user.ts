import type { Me, TokenSet } from "@rulemix/spotify";
import type postgres from "postgres";
import { encrypt } from "../crypto";

/** Creates or updates the user row from a fresh Spotify sign-in (web callback and mobile). */
export async function upsertSpotifyUser(
  sql: postgres.Sql,
  tokens: TokenSet,
  me: Me,
): Promise<void> {
  await sql`
    insert into users (id, account_id, display_name, refresh_token_encrypted,
      access_token, access_token_expires_at, scopes, authorized_at)
    values (${me.id}, ${me.accountId}, ${me.displayName}, ${encrypt(tokens.refreshToken)},
      ${tokens.accessToken}, ${new Date(tokens.expiresAt)}, ${tokens.scope}, now())
    on conflict (id) do update set account_id = excluded.account_id,
      display_name = excluded.display_name, refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token = excluded.access_token, access_token_expires_at = excluded.access_token_expires_at,
      scopes = excluded.scopes, authorized_at = excluded.authorized_at`;
}
