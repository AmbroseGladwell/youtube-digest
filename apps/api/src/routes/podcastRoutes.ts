import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  parsePodcastLink,
  TRIAL_OVERVIEWS,
  TRIAL_TOKEN_HEADER,
  type Plan,
  type PodcastRead,
  type StoredTranscript,
} from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { AccountId } from "../auth/AccountId.js";
import {
  MatchUnconfirmedError,
  type PodcastTranscriptAnswer,
  type PodcastTranscriptRequest,
  type YouTubeAsk,
} from "../podcasts/createPodcastTranscripts.js";
import { QuotaSpentError } from "../transcripts/ServiceTranscripts.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { ServiceCaller } from "../transcripts/ServiceTranscripts.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const TranscriptBody = z
  .object({
    feedUrl: z.url().max(2048),
    guid: z.string().min(1).max(2048),
    youTubeVideoId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/)
      .optional(),
    searchYouTube: z.boolean().optional(),
  })
  .refine((body) => body.youTubeVideoId === undefined || body.searchYouTube !== true, "Name a video or ask for a search, not both");

type ResolveTranscript = (request: PodcastTranscriptRequest) => Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }>;

// An account, or signed out a trial token making onboarding's overview, and never the link, the
// feed or the episode in a log: what someone listens to is theirs. A read spends one of the
// trial's reads, as an article's does; finding the words is part of the trial's one overview
// (docs/features/podcast-links.md, docs/features/podcast-transcripts.md, docs/features/onboarding.md).
export function podcastRoutes(
  app: FastifyInstance,
  {
    readEpisode,
    resolveTranscript,
    planOf,
    trials,
    clock,
  }: {
    readEpisode: (link: string) => Promise<PodcastRead>;
    resolveTranscript: ResolveTranscript;
    planOf: (accountId: AccountId) => Promise<Plan>;
    trials: TrialsRepository;
    clock: () => Date;
  },
): void {
  // Signed out, the words are found only for a trial that hasn't made its overview yet.
  const callerOf = async (request: FastifyRequest): Promise<ServiceCaller> => {
    if (request.session !== null) return { accountId: request.session.accountId, plan: await planOf(request.session.accountId) };
    const trialToken = request.headers[TRIAL_TOKEN_HEADER];
    if (typeof trialToken !== "string") throw new ApiError("unauthenticated", "Sign in, or start a trial, to make an overview");
    const used = await trials.used(trialToken);
    if (used === null) throw new ApiError("unauthenticated", "This trial isn't known here", { trial: "unknown" });
    if (used >= TRIAL_OVERVIEWS) {
      throw new ApiError("too_many_requests", "You've made the overviews you can without an account", { quota: "trial" });
    }
    return { address: request.clientAddress };
  };

  app.post(
    "/podcasts/read",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.podcastReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<PodcastRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, "The podcast link");
      await reserveTrialRead(request, reply, { trials, clock });
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
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.podcastTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<StoredTranscript> => {
      const { feedUrl, guid, youTubeVideoId, searchYouTube } = parseOrThrow(TranscriptBody, request.body, "The episode");
      const caller = await callerOf(request);
      const youTube: YouTubeAsk =
        youTubeVideoId !== undefined ? { videoId: youTubeVideoId } : searchYouTube === true ? { search: true } : null;
      const startedAt = clock().getTime();
      try {
        const { transcript, answer } = await resolveTranscript({
          feedUrl,
          guid,
          youTube,
          caller,
          log: request.log,
        });
        request.log.info(
          apiLogLines.podcasts.transcript({
            via: answer.via,
            format: answer.via === "tag" ? answer.format : null,
            matchedBy: answer.via === "youtube" ? answer.matchedBy : null,
            searchedBy: answer.via === "youtube" ? answer.searchedBy : null,
            segments: transcript.segments.length,
            ms: clock().getTime() - startedAt,
          }),
        );
        return transcript;
      } catch (error) {
        if (error instanceof QuotaSpentError) {
          reply.header("retry-after", String(error.retryAfterSeconds));
          throw new ApiError("too_many_requests", error.message, { retryAfterSeconds: error.retryAfterSeconds, daily: true });
        }
        if (!(error instanceof TranscriptFetchError)) throw error;
        const unconfirmed = error instanceof MatchUnconfirmedError;
        request.log.info(
          apiLogLines.podcasts.transcript({
            failure: error.failure,
            unconfirmed,
            asked: youTube === null ? null : "videoId" in youTube ? "check" : "search",
            ms: clock().getTime() - startedAt,
          }),
        );
        throw new ApiError("transcript_unavailable", error.message, {
          failure: error.failure,
          ...(unconfirmed ? { match: "unconfirmed" } : {}),
        });
      }
    },
  );
}
