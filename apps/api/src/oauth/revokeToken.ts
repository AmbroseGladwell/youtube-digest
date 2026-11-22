import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";

export interface RevokeTokenOptions {
  token: string;
  clientId: string;
}

// Either of a connection's tokens revokes the whole connection: an assistant disconnecting
// means it is done with the account (RFC 7009 §2.1).
export const revokeToken = async (sql: SqlClient, { token, clientId }: RevokeTokenOptions): Promise<string | null> => {
  const [row] = await sql.query<{ id: string }>(
    `delete from connections c using connection_tokens t
      where t.token_hash = $1 and t.connection_id = c.id and c.client_id = $2
      returning c.id`,
    [hashToken(token), clientId],
  );
  return row?.id ?? null;
};
