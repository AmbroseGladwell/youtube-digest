import fp from "fastify-plugin";
import { CLIENT_VERSION_HEADER } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Why no exemptions: docs/architecture/api.md, "Versions on the wire".
export const writeFloorPlugin = fp<{ minSupportedClientVersion: number }>(async (app, { minSupportedClientVersion }) => {
  app.addHook("onRequest", async (request) => {
    if (request.is404 || request.routeOptions.config.public || READ_METHODS.has(request.method)) {
      return;
    }
    if (request.client === null) {
      throw new ApiError("invalid_request", `${CLIENT_VERSION_HEADER} is required to write`);
    }
    if (request.client.version < minSupportedClientVersion) {
      throw new ApiError("client_unsupported", "This version of the app can no longer write. Update it.", {
        clientVersion: request.client.version,
        minSupportedClientVersion,
      });
    }
  });
});
