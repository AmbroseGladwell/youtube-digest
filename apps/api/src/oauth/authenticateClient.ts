import { timingSafeEqual } from "node:crypto";
import type { SqlClient } from "../db/SqlClient.js";
import { hashToken } from "../auth/hashToken.js";
import { findClient } from "./findClient.js";
import type { OAuthClient } from "./OAuthClient.js";
import { OAuthError } from "./OAuthError.js";

const BASIC = /^Basic\s+(\S+)$/i;

interface PresentedCredentials {
  clientId: string | null;
  clientSecret: string | null;
}

function presented(authorization: string | undefined, body: Record<string, unknown>): PresentedCredentials {
  const basic = authorization === undefined ? null : BASIC.exec(authorization)?.[1];
  if (basic !== null && basic !== undefined) {
    const decoded = Buffer.from(basic, "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon < 0) {
      return { clientId: null, clientSecret: null };
    }
    try {
      return {
        clientId: decodeURIComponent(decoded.slice(0, colon)),
        clientSecret: decodeURIComponent(decoded.slice(colon + 1)),
      };
    } catch {
      return { clientId: null, clientSecret: null };
    }
  }
  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  return { clientId: text(body.client_id), clientSecret: text(body.client_secret) };
}

const sameHash = (secret: string, hash: string): boolean =>
  timingSafeEqual(Buffer.from(hashToken(secret)), Buffer.from(hash));

// A public client proves nothing here and PKCE does that job instead; a confidential one
// must present the secret it was given, by either transport (docs/features/mcp-connector.md).
export async function authenticateClient(
  sql: SqlClient,
  authorization: string | undefined,
  body: Record<string, unknown>,
): Promise<OAuthClient> {
  const { clientId, clientSecret } = presented(authorization, body);
  const client = clientId === null ? null : await findClient(sql, clientId);
  if (client === null) {
    throw new OAuthError("invalid_client", "Unknown client");
  }
  const authenticated =
    client.clientSecretHash === null ? clientSecret === null : clientSecret !== null && sameHash(clientSecret, client.clientSecretHash);
  if (!authenticated) {
    throw new OAuthError("invalid_client", "Client authentication failed");
  }
  return client;
}
