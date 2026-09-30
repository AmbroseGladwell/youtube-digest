import type { FastifyInstance, FastifyReply } from "fastify";
import type { SqlClient } from "../db/SqlClient.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { handleMcpMessage, JSON_RPC_ERRORS, jsonRpcError, MCP_PROTOCOL_VERSIONS } from "./handleMcpMessage.js";

export interface McpRoutesOptions {
  sql: SqlClient;
  transcripts: TranscriptsRepository;
  appOrigin: string;
}

const PROTOCOL_VERSION_HEADER = "mcp-protocol-version";

const onlyPost = (reply: FastifyReply) =>
  reply
    .status(405)
    .header("allow", "POST")
    .send(jsonRpcError(null, JSON_RPC_ERRORS.invalidRequest, "This server sends nothing unasked: POST each message"));

// Runs after connectionAccessPlugin, so every request here carries a connection
// (docs/features/mcp-connector.md, "The endpoint").
export function mcpRoutes(app: FastifyInstance, { sql, transcripts, appOrigin }: McpRoutesOptions): void {
  app.post("/mcp", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== appOrigin) {
      return reply.status(403).send(jsonRpcError(null, JSON_RPC_ERRORS.invalidRequest, "Requests from this origin are not accepted"));
    }
    const version = request.headers[PROTOCOL_VERSION_HEADER];
    if (typeof version === "string" && !MCP_PROTOCOL_VERSIONS.includes(version)) {
      return reply.status(400).send(jsonRpcError(null, JSON_RPC_ERRORS.invalidRequest, `Unsupported protocol version ${version}`));
    }
    const access = request.connectionAccess!;
    const handled = await handleMcpMessage(request.body, {
      sql,
      transcripts,
      accountId: access.accountId,
      connectionId: access.connectionId,
      log: request.log,
    });
    if (handled.kind === "accepted") {
      return reply.status(202).send();
    }
    return reply.status(200).send(handled.body);
  });

  app.get("/mcp", async (_request, reply) => onlyPost(reply));
  app.delete("/mcp", async (_request, reply) => onlyPost(reply));
}
