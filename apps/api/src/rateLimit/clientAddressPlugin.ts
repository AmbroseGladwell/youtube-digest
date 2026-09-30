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

// Behind Fly's proxy the socket is the proxy, so the caller's address is the header the
// proxy sets and a client cannot. Unconfigured, the socket is the caller
// (docs/architecture/api.md, "Rate limits").
export const clientAddressPlugin = fp<ClientAddressPluginOptions>(async (app, { clientIpHeader }) => {
  app.decorateRequest("clientAddress", "");
  app.addHook("onRequest", async (request) => {
    const header = clientIpHeader === null ? undefined : request.headers[clientIpHeader];
    const forwarded = typeof header === "string" && header.trim() !== "" ? header : request.ip;
    request.clientAddress = addressKey(forwarded);
  });
});
