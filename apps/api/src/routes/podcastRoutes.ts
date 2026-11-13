import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, parsePodcastLink, type PodcastRead, type StoredTranscript } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { PodcastTranscriptAnswer } from "../podcasts/createPodcastTranscripts.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const TranscriptBody = z.object({ feedUrl: z.url().max(2048), guid: z.string().min(1).max(2048) });

type ResolveTranscript = (episode: {
  feedUrl: string;
  guid: string;
}) => Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }>;

// An account only, and never the link, the feed or the episode in a log: what someone listens
// to is theirs. Onboarding's trial joins when podcasts join its table
// (docs/features/podcast-links.md, docs/features/podcast-transcripts.md).
export function podcastRoutes(
  app: FastifyInstance,
  {
    readEpisode,
    resolveTranscript,
    clock,
  }: { readEpisode: (link: string) => Promise<PodcastRead>; resolveTranscript: ResolveTranscript; clock: () => Date },
): void {
  app.post(
    "/podcasts/read",
    { preHandler: rateLimitHook(rateLimits.podcastReadPerAddress, (request) => request.clientAddress, clock) },
    async (request): Promise<PodcastRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, "The podcast link");
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

  app.post(
    "/podcasts/transcript",
    { preHandler: rateLimitHook(rateLimits.podcastTranscriptPerAddress, (request) => request.clientAddress, clock) },
    async (request): Promise<StoredTranscript> => {
      const episode = parseOrThrow(TranscriptBody, request.body, "The episode");
      const startedAt = clock().getTime();
      try {
        const { transcript, answer } = await resolveTranscript(episode);
        request.log.info(
          apiLogLines.podcasts.transcript({
            via: answer.via,
            format: answer.via === "tag" ? answer.format : null,
            segments: transcript.segments.length,
            ms: clock().getTime() - startedAt,
          }),
        );
        return transcript;
      } catch (error) {
        if (!(error instanceof TranscriptFetchError)) throw error;
        request.log.info(apiLogLines.podcasts.transcript({ failure: error.failure, ms: clock().getTime() - startedAt }));
        throw new ApiError("transcript_unavailable", error.message, { failure: error.failure });
      }
    },
  );
}
