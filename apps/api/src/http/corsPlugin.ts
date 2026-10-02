import cors from "@fastify/cors";
import fp from "fastify-plugin";
import { CLIENT_SURFACE_HEADER, CLIENT_VERSION_HEADER, REQUEST_ID_HEADER } from "@overview/domain";

export interface CorsPluginOptions {
  allowedOrigins: string[];
}

// The extension is a separate origin, so the browser asks this server to vouch for it
// before every sync call. Only the origins named in config are vouched for
// (docs/architecture/api.md).
export const corsPlugin = fp<CorsPluginOptions>(async (app, { allowedOrigins }) => {
  await app.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "if-match", CLIENT_VERSION_HEADER, CLIENT_SURFACE_HEADER, REQUEST_ID_HEADER],
    exposedHeaders: ["etag", "retry-after", REQUEST_ID_HEADER],
    maxAge: 3600,
  });
});
