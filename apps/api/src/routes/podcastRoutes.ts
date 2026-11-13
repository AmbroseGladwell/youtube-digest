import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, parsePodcastLink, type PodcastRead } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";

const Body = z.object({ url: z.string().min(1).max(2048) });

// An account only, and never the link in a log: what someone listens to is theirs. Onboarding's
// trial joins when podcasts join its table (docs/features/podcast-links.md).
export function podcastRoutes(
  app: FastifyInstance,
  { readEpisode, clock }: { readEpisode: (link: string) => Promise<PodcastRead>; clock: () => Date },
): void {
  app.post(
    "/podcasts/read",
    { preHandler: rateLimitHook(rateLimits.podcastReadPerAddress, (request) => request.clientAddress, clock) },
    async (request): Promise<PodcastRead> => {
      const { url } = parseOrThrow(Body, request.body, "The podcast link");
      const startedAt = clock().getTime();
      const read = await readEpisode(url);
      const platform = parsePodcastLink(url)?.platform ?? "none";
      request.log.info(
        apiLogLines.podcasts.read({
          linkFrom: read.status === "read" ? read.episode.linkFrom : platform,
          outcome: read.status === "read" ? "read" : read.reason,
          transcriptTags: read.status === "read" ? read.episode.transcripts.length : null,
          ms: clock().getTime() - startedAt,
        }),
      );
      return read;
    },
  );
}
