# syntax=docker/dockerfile:1
# The API and the web app it serves, in one image (docs/architecture/deploy.md).
FROM node:22-slim AS build
# The slim image has no CA certificates, and PostHog's CLI needs them to reach its API.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ARG BUILD_COMMIT
ENV BUILD_COMMIT=$BUILD_COMMIT
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build:packages && npm run build --workspace apps/web && npm run build --workspace apps/api
# The PostHog key is a build secret, so no layer keeps it. Without one, the web app's maps are
# deleted rather than uploaded (docs/architecture/errors-and-logs.md, "Source maps").
RUN --mount=type=secret,id=POSTHOG_CLI_API_KEY --mount=type=secret,id=POSTHOG_CLI_PROJECT_ID \
    POSTHOG_CLI_API_KEY="$(cat /run/secrets/POSTHOG_CLI_API_KEY 2>/dev/null || true)" \
    POSTHOG_CLI_PROJECT_ID="$(cat /run/secrets/POSTHOG_CLI_PROJECT_ID 2>/dev/null || true)" \
    node scripts/uploadSourceMaps.mjs apps/web/dist overview-web

FROM node:22-slim
ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_ROOT=/app/apps/web/dist
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/web/package.json apps/web/
COPY --from=build /app/packages/app-core/package.json packages/app-core/
COPY --from=build /app/packages/domain/package.json packages/domain/
COPY --from=build /app/packages/generation/package.json packages/generation/
COPY --from=build /app/packages/store-conformance/package.json packages/store-conformance/
COPY --from=build /app/packages/store-local/package.json packages/store-local/
COPY --from=build /app/packages/sync/package.json packages/sync/
COPY --from=build /app/packages/transcripts/package.json packages/transcripts/
RUN npm ci --omit=dev --workspace apps/api --ignore-scripts && npm cache clean --force
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/migrations apps/api/migrations
COPY --from=build /app/apps/api/assets apps/api/assets
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
