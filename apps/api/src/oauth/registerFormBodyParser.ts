import type { FastifyInstance } from "fastify";

export function registerFormBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });
}
