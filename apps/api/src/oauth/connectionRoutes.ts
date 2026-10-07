import type { FastifyInstance } from "fastify";
import {
  apiLogLines,
  ConnectionDecision,
  type ConnectionDecided,
  type ConnectionRequest,
  type Connections,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { connectionWrites } from "./connectionScope.js";
import { decideAuthorization } from "./decideAuthorization.js";
import { findPendingAuthorization } from "./findPendingAuthorization.js";
import { listConnections } from "./listConnections.js";
import type { OAuthUrls } from "./oauthUrls.js";
import { revokeConnection } from "./revokeConnection.js";

export interface ConnectionRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  urls: OAuthUrls;
}

const PUBLIC = { config: { public: true } };

const notPending = () => new ApiError("not_found", "This request has expired or was already answered");

// The reader's half of connecting an assistant: the consent screen and Settings. Everything
// but reading a request is on the reader's own session (docs/features/mcp-connector.md).
export function connectionRoutes(app: FastifyInstance, { sql, clock, urls }: ConnectionRoutesOptions): void {
  app.get<{ Params: { id: string } }>("/oauth/requests/:id", PUBLIC, async (request) => {
    const pending = await findPendingAuthorization(sql, request.params.id, clock());
    if (pending === null) {
      throw notPending();
    }
    const connectionRequest: ConnectionRequest = {
      id: pending.id,
      clientName: pending.clientName,
      redirectHost: new URL(pending.redirectUri).host,
      writes: connectionWrites(pending.scope),
      expiresAt: pending.expiresAt,
    };
    return connectionRequest;
  });

  app.post<{ Params: { id: string } }>("/oauth/requests/:id/decision", async (request) => {
    const { approve } = parseOrThrow(ConnectionDecision, request.body, "The decision");
    const { accountId } = request.session!;
    const now = clock();
    if ((await findPendingAuthorization(sql, request.params.id, now)) === null) {
      throw notPending();
    }
    const redirectTo = await decideAuthorization(sql, { id: request.params.id, accountId, approve, urls, now });
    if (redirectTo === null) {
      throw notPending();
    }
    request.log.info(apiLogLines.mcp.connectionRequestDecided({ approved: approve }));
    const decided: ConnectionDecided = { redirectTo };
    return decided;
  });

  app.get("/connections", async (request) => {
    const connections: Connections = {
      connections: await listConnections(sql, request.session!.accountId, clock()),
    };
    return connections;
  });

  app.delete<{ Params: { id: string } }>("/connections/:id", async (request, reply) => {
    const revoked = await revokeConnection(sql, { accountId: request.session!.accountId, id: request.params.id });
    if (!revoked) {
      throw new ApiError("not_found", "No such connection");
    }
    request.log.info(apiLogLines.mcp.connectionRevoked({ connectionId: request.params.id, by: "reader" }));
    return reply.status(204).send();
  });
}
