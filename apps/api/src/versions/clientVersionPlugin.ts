import fp from "fastify-plugin";
import { CLIENT_VERSION_HEADER, schemaVersionsForClient } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import type { ClientContext } from "./ClientContext.js";

declare module "fastify" {
  interface FastifyRequest {
    client: ClientContext | null;
  }
}

const WHOLE_NUMBER = /^[1-9]\d*$/;

// One number a client says about itself, from which the server derives everything else
// it needs to know about that client's versions (docs/architecture/api.md).
export const clientVersionPlugin = fp(async (app) => {
  app.decorateRequest("client", null);
  app.addHook("onRequest", async (request) => {
    const header = request.headers[CLIENT_VERSION_HEADER];
    if (header === undefined) {
      return;
    }
    if (Array.isArray(header) || !WHOLE_NUMBER.test(header)) {
      throw new ApiError("invalid_request", `${CLIENT_VERSION_HEADER} must be one whole number`);
    }
    const version = Number(header);
    request.client = { version, schemaVersions: schemaVersionsForClient(version) };
  });
});
