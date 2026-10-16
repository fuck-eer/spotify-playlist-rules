import type { TokenSet, TokenStore } from "@rulemix/spotify";
import type postgres from "postgres";
import { decrypt, encrypt } from "../crypto";

interface Row {
  refresh_token_encrypted: string;
  access_token: string | null;
  access_token_expires_at: Date | null;
  scopes: string;
}

/** TokenStore over users: refresh token encrypted at rest; access token cached in columns. */
export function dbTokenStore(sql: postgres.Sql, userId: string): TokenStore {
  return {
    async get(): Promise<TokenSet> {
      const [r] = await sql<Row[]>`
        select refresh_token_encrypted, access_token, access_token_expires_at, scopes
        from users where id = ${userId}`;
      if (!r) throw new Error(`No user ${userId}`);
      return {
        refreshToken: decrypt(r.refresh_token_encrypted),
        accessToken: r.access_token ?? "",
        expiresAt: r.access_token_expires_at?.getTime() ?? 0,
        scope: r.scopes,
      };
    },
    async set(t: TokenSet): Promise<void> {
      await sql`
        update users set refresh_token_encrypted = ${encrypt(t.refreshToken)},
          access_token = ${t.accessToken}, access_token_expires_at = ${new Date(t.expiresAt)},
          scopes = ${t.scope || sql`scopes`}
        where id = ${userId}`;
    },
  };
}
