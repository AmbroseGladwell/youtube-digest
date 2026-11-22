import fp from "fastify-plugin";
import { addressKey } from "./addressKey.js";

export interface ClientAddressPluginOptions {
  clientIpHeader: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    clientAddress: string;
  }
}

// Why a proxy header names the caller: docs/architecture/api.md, "Rate limits".
export const clientAddressPlugin = fp<ClientAddressPluginOptions>(async (app, { clientIpHeader }) => {
  app.decorateRequest("clientAddress", "");
  app.addHook("onRequest", async (request) => {
    const header = clientIpHeader === null ? undefined : request.headers[clientIpHeader];
    const forwarded = typeof header === "string" && header.trim() !== "" ? header : request.ip;
    request.clientAddress = addressKey(forwarded);
  });
});
