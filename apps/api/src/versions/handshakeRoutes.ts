import type { FastifyInstance } from "fastify";
import { CLIENT_VERSION, type Handshake } from "@overview/domain";

export function handshakeRoutes(app: FastifyInstance, minSupportedClientVersion: number): void {
  app.get("/handshake", { config: { public: true } }, async (_request, reply) => {
    const handshake: Handshake = { minSupportedClientVersion, currentClientVersion: CLIENT_VERSION };
    return reply.header("cache-control", "no-store").send(handshake);
  });
}
