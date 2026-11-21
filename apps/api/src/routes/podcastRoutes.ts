import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  parsePodcastLink,
  TRIAL_TOKEN_HEADER,
  type Plan,
  type PodcastRead,
  type PodcastTranscription,
  type StoredTranscript,
  type TranscriptCheck,
} from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { AccountId } from "../auth/AccountId.js";
import {
  MatchUnconfirmedError,
  type PodcastTranscriptCheck,
  type PodcastTranscriptCheckRequest,
  type PodcastTranscriptAnswer,
  type PodcastTranscriptRequest,
  type YouTubeAsk,
} from "../podcasts/createPodcastTranscripts.js";
import type { createPodcastTranscriptions } from "../podcasts/createPodcastTranscriptions.js";
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

const TranscriptionBody = z.object({ feedUrl: z.url().max(2048), guid: z.string().min(1).max(2048) });
const TranscriptionParams = z.object({ id: z.uuid() });

const youTubeAskOf = ({ youTubeVideoId, searchYouTube }: z.infer<typeof TranscriptBody>): YouTubeAsk =>
  youTubeVideoId !== undefined ? { videoId: youTubeVideoId } : searchYouTube === true ? { search: true } : null;

type ResolveTranscript = (request: PodcastTranscriptRequest) => Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }>;

// An account, and never the link, the feed or the episode in a log: what someone listens to is
// theirs. Signed out, onboarding reads the episode on the trial's reads and checks whether it has
// words, before an account; finding the words and transcribing wait for one (OV-327,
// docs/features/podcast-links.md, docs/features/podcast-transcripts.md, docs/features/onboarding.md).
export function podcastRoutes(
  app: FastifyInstance,
  {
    readEpisode,
    resolveTranscript,
    checkTranscript,
    planOf,
    trials,
    transcriptions,
    clock,
  }: {
    readEpisode: (link: string) => Promise<PodcastRead>;
    resolveTranscript: ResolveTranscript;
    checkTranscript: (request: PodcastTranscriptCheckRequest) => Promise<PodcastTranscriptCheck>;
    // Speech-to-text on our GPU host; absent, no episode is transcribed and none is offered.
    transcriptions: ReturnType<typeof createPodcastTranscriptions> | null;
    planOf: (accountId: AccountId) => Promise<Plan>;
    trials: TrialsRepository;
    clock: () => Date;
  },
): void {
  const accountCallerOf = async (request: FastifyRequest): Promise<ServiceCaller> => {
    if (request.session === null) throw new ApiError("unauthenticated", "Sign in to make an overview");
    return { accountId: request.session.accountId, plan: await planOf(request.session.accountId) };
  };
  // The check alone runs signed out, on a trial the server issued.
  const checkCallerOf = async (request: FastifyRequest): Promise<ServiceCaller> => {
    if (request.session !== null) return accountCallerOf(request);
    const trialToken = request.headers[TRIAL_TOKEN_HEADER];
    if (typeof trialToken !== "string") throw new ApiError("unauthenticated", "Sign in, or start a trial, to check an episode");
    if (!(await trials.isKnown(trialToken))) throw new ApiError("unauthenticated", "This trial isn't known here", { trial: "unknown" });
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
      preHandler: rateLimitHook(rateLimits.podcastTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<StoredTranscript> => {
      const body = parseOrThrow(TranscriptBody, request.body, "The episode");
      const { feedUrl, guid } = body;
      const caller = await accountCallerOf(request);
      const youTube = youTubeAskOf(body);
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
            from: answer.via === "remembered" ? answer.from : null,
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
          ...(transcriptions !== null && error.failure === TranscriptFetchFailure.NO_CAPTIONS ? { transcribable: true } : {}),
        });
      }
    },
  );

  // Whether an episode's words can be found, asked as its link is read so the card can say it needs
  // transcribing before Create; no words are fetched and nothing is counted (designs 305c, 305c-2).
  app.post(
    "/podcasts/transcript/check",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.podcastTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request): Promise<TranscriptCheck> => {
      const body = parseOrThrow(TranscriptBody, request.body, "The episode");
      const caller = await checkCallerOf(request);
      // Where nothing can be transcribed, the card has nothing to say, so the feed isn't read and
      // no YouTube search is spent: Create looks for the words as it always has.
      if (transcriptions === null) return { words: "unknown" };
      const startedAt = clock().getTime();
      const checked = await checkTranscript({ feedUrl: body.feedUrl, guid: body.guid, youTube: youTubeAskOf(body), log: request.log });
      const answer: TranscriptCheck =
        checked.words !== "none"
          ? { words: checked.words }
          : {
              words: "none",
              transcription: await transcriptions.offer(checked.episode, caller),
            };
      request.log.info(
        apiLogLines.podcasts.checked({
          words: answer.words,
          via: "via" in checked ? checked.via : null,
          offer: answer.words === "none" ? answer.transcription.status : null,
          ms: clock().getTime() - startedAt,
        }),
      );
      return answer;
    },
  );

  // Only when the reader asks: never started for them in the background (docs/features/speech-to-text.md).
  app.post(
    "/podcasts/transcription",
    {
      preHandler: rateLimitHook(rateLimits.transcriptionPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<PodcastTranscription> => {
      if (transcriptions === null) throw new ApiError("unavailable", "Episodes can't be transcribed here");
      const { feedUrl, guid } = parseOrThrow(TranscriptionBody, request.body, "The episode");
      const caller = await accountCallerOf(request);
      const started = await transcriptions.start(feedUrl, guid, caller, request.log);
      switch (started.status) {
        case "started":
          return started.transcription;
        case "over-allowance":
          reply.header("retry-after", String(started.retryAfterSeconds));
          throw new ApiError("too_many_requests", "You've transcribed as many hours of episodes as you can this month", {
            quota: "transcription",
            usedSeconds: started.usedSeconds,
            limitSeconds: started.limitSeconds,
            retryAfterSeconds: started.retryAfterSeconds,
          });
        case "too-long":
          throw new ApiError("transcript_unavailable", "The episode is too long to transcribe", {
            transcription: "too-long",
            episodeSeconds: started.episodeSeconds,
          });
        case "no-audio":
          throw new ApiError("transcript_unavailable", "The episode's feed offers no audio to transcribe", { transcription: "no-audio" });
        case "feed-unreadable":
          throw new ApiError("transcript_unavailable", "The show's feed couldn't be read", {
            failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
          });
        case "not-in-feed":
          throw new ApiError("transcript_unavailable", "The episode isn't in its show's feed", {
            failure: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
          });
      }
    },
  );

  // Asked after every few seconds while the reader waits, so held only to the address limit.
  app.get("/podcasts/transcription/:id", async (request): Promise<PodcastTranscription> => {
    if (transcriptions === null) throw new ApiError("unavailable", "Episodes can't be transcribed here");
    const { id } = parseOrThrow(TranscriptionParams, request.params, "The transcription");
    const caller = await accountCallerOf(request);
    const transcription = await transcriptions.status(id, caller);
    if (transcription === null) throw new ApiError("not_found", "No such transcription");
    return transcription;
  });
}
