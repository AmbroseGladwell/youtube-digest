import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

const HASHED_ASSETS = "/assets/";

export interface WebAppPluginOptions {
  root: string;
}

// The other half of the one-origin decision: the built web app served by the process
// that answers /api. Hashed assets are immutable for a year; index.html must revalidate,
// or a tab would keep HTML that points at bundles a deploy has deleted
// (docs/features/record-migrations.md, docs/architecture/deploy.md).
export const webAppPlugin = fp<WebAppPluginOptions>(async (app, { root }) => {
  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    index: false,
    wildcard: false,
    setHeaders: (reply, path) => {
      reply.header(
        "cache-control",
        path.includes(HASHED_ASSETS) ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  });

  app.setNotFoundHandler(async (request, reply) => {
    const isPage = (request.method === "GET" || request.method === "HEAD") && !request.url.startsWith(HASHED_ASSETS);
    if (!isPage) {
      return reply.status(404).send({ error: { code: "not_found", message: `No route for ${request.method} ${request.url}` } });
    }
    return reply.header("cache-control", "no-cache").sendFile("index.html");
  });
});
