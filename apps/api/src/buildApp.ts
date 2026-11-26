import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { REQUEST_ID_HEADER, type Plan, type PodcastRead, type ShareToken } from "@overview/domain";
import type { AccountId } from "./auth/AccountId.js";
import { AudioRenderQueue } from "./audio/AudioRenderQueue.js";
import { AudioRendersRepository } from "./audio/AudioRendersRepository.js";
import type { AudioStore } from "./audio/AudioStore.js";
import type { Narrator } from "./audio/Narrator.js";
import { VoiceSamplesRepository } from "./audio/VoiceSamplesRepository.js";
import { authRoutes } from "./auth/authRoutes.js";
import { sessionPlugin } from "./auth/sessionPlugin.js";
import { sessionRoutes } from "./auth/sessionRoutes.js";
import type { PersonEraser } from "./postHog/PersonEraser.js";
import type { SqlClient } from "./db/SqlClient.js";
import { SLOW_QUERY_MS, timedSqlClient } from "./db/timedSqlClient.js";
import { eventRoutes } from "./events/eventRoutes.js";
import { sharedPageEventRoutes } from "./events/sharedPageEventRoutes.js";
import type { EventSink } from "./events/EventSink.js";
import { errorRoutes } from "./errors/errorRoutes.js";
import { feedbackRoutes } from "./feedback/feedbackRoutes.js";
import type { ErrorSink } from "./errors/ErrorSink.js";
import { registerApiErrorHandler } from "./http/apiErrorHandler.js";
import { requestIdFor } from "./http/requestIdFor.js";
import { corsPlugin } from "./http/corsPlugin.js";
import { webAppPlugin } from "./http/webAppPlugin.js";
import { CodedLogController } from "./logs/CodedLogController.js";
import { currentLog, trackCurrentRequest } from "./logs/currentLog.js";
import type { Mailer } from "./mail/Mailer.js";
import { AccountCostsRepository } from "./costs/AccountCostsRepository.js";
import { LiveSpeechLane } from "./speech/LiveSpeechLane.js";
import { ClaimEmbeddingsRepository } from "./meaning/ClaimEmbeddingsRepository.js";
import type { Embedder } from "./meaning/Embedder.js";
import { EmbeddingQueue } from "./meaning/EmbeddingQueue.js";
import { MeaningSearch } from "./meaning/MeaningSearch.js";
import { connectionAccessPlugin } from "./mcp/connectionAccessPlugin.js";
import { mcpRoutes } from "./mcp/mcpRoutes.js";
import { registerMcpErrorHandler } from "./mcp/registerMcpErrorHandler.js";
import { connectionRoutes } from "./oauth/connectionRoutes.js";
import { oauthRoutes } from "./oauth/oauthRoutes.js";
import { oauthUrls } from "./oauth/oauthUrls.js";
import { registerFormBodyParser } from "./oauth/registerFormBodyParser.js";
import { registerOAuthErrorHandler } from "./oauth/registerOAuthErrorHandler.js";
import { clientAddressPlugin } from "./rateLimit/clientAddressPlugin.js";
import { rateLimitHook } from "./rateLimit/rateLimitHook.js";
import { rateLimits } from "./rateLimit/rateLimits.js";
import { SuggestedQuestionRefresher } from "./questions/SuggestedQuestionRefresher.js";
import { RecordsRepository } from "./records/RecordsRepository.js";
import { audioRoutes } from "./routes/audioRoutes.js";
import { changesRoutes } from "./routes/changesRoutes.js";
import { followedPlaylistRoutes } from "./routes/followedPlaylistRoutes.js";
import { overviewRoutes } from "./routes/overviewRoutes.js";
import { overviewUsageRoutes } from "./routes/overviewUsageRoutes.js";
import { generationRoutes } from "./routes/generationRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { meaningSearchRoutes } from "./routes/meaningSearchRoutes.js";
import { transcriptSearchRoutes } from "./routes/transcriptSearchRoutes.js";
import { overviewReservationRoutes } from "./routes/overviewReservationRoutes.js";
import { articleRoutes } from "./routes/articleRoutes.js";
import { videoRoutes } from "./routes/videoRoutes.js";
import { createArticlePageFetcher, type FetchedPage } from "./articles/fetchArticlePage.js";
import { podcastRoutes } from "./routes/podcastRoutes.js";
import { socialRoutes } from "./routes/socialRoutes.js";
import { tiktokRoutes } from "./routes/tiktokRoutes.js";
import { accountPlan } from "./auth/accountPlan.js";
import { createPodcastReader } from "./podcasts/createPodcastReader.js";
import type { SocialPostReader } from "./social/createSocialPostReader.js";
import type { TikTokReader } from "./tiktok/createTikTokReader.js";
import { createPodcastTranscripts } from "./podcasts/createPodcastTranscripts.js";
import { APPLE_BUDGET } from "./podcasts/callBudget.js";
import type { ShowDirectory } from "./podcasts/appleDirectory.js";
import type { YouTubeEpisodes } from "./podcasts/youTubeDataApiEpisodes.js";
import { EpisodeWordSourcesRepository } from "./podcasts/EpisodeWordSourcesRepository.js";
import { createPodcastTranscriptions } from "./podcasts/createPodcastTranscriptions.js";
import { PodcastTranscriptionsRepository } from "./podcasts/PodcastTranscriptionsRepository.js";
import { TranscriptionQueue } from "./podcasts/TranscriptionQueue.js";
import type { Transcriber } from "./podcasts/Transcriber.js";
import { createPublicWebFetch } from "./publicWeb/createPublicWebFetch.js";
import { playlistRoutes } from "./routes/playlistRoutes.js";
import type { PlaylistReader } from "./playlists/PlaylistReader.js";
import type { VideoReader } from "./videos/youTubeDataApiVideoReader.js";
import { VideoKindsRepository } from "./videos/VideoKindsRepository.js";
import { serviceTranscriptRoutes } from "./routes/serviceTranscriptRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { shareRoutes } from "./routes/shareRoutes.js";
import { sampleRoutes } from "./routes/sampleRoutes.js";
import { topicRoutes } from "./routes/topicRoutes.js";
import { projectRoutes } from "./routes/projectRoutes.js";
import { suggestedQuestionRoutes } from "./routes/suggestedQuestionRoutes.js";
import { captureRoutes } from "./routes/captureRoutes.js";
import { chatRoutes } from "./routes/chatRoutes.js";
import { chatSpeechRoutes } from "./routes/chatSpeechRoutes.js";
import { transcriptRoutes } from "./routes/transcriptRoutes.js";
import { sharePagePlugin } from "./shares/sharePagePlugin.js";
import { SharesRepository } from "./shares/SharesRepository.js";
import type { ServiceFetches } from "./transcripts/fetchThroughService.js";
import { ServiceTranscripts } from "./transcripts/ServiceTranscripts.js";
import { ServiceUsageRepository } from "./transcripts/ServiceUsageRepository.js";
import { OverviewReservationsRepository } from "./usage/OverviewReservationsRepository.js";
import { OverviewUsageRepository } from "./usage/OverviewUsageRepository.js";
import { CaptureClaimsRepository } from "./usage/CaptureClaimsRepository.js";
import { CaptureSavesRepository } from "./usage/CaptureSavesRepository.js";
import { TrialsRepository } from "./usage/TrialsRepository.js";
import { OurKeyGenerator } from "./generation/OurKeyGenerator.js";
import { ChatAnswerer } from "./chats/ChatAnswerer.js";
import { LibraryChatAnswerer } from "./chats/LibraryChatAnswerer.js";
import { TranscriptPassagesRepository } from "./transcripts/TranscriptPassagesRepository.js";
import { ChatUsageRepository } from "./usage/ChatUsageRepository.js";
import { TranscriptsRepository } from "./transcripts/TranscriptsRepository.js";
import { clientVersionPlugin } from "./versions/clientVersionPlugin.js";
import { handshakeRoutes } from "./versions/handshakeRoutes.js";
import { writeFloorPlugin } from "./versions/writeFloorPlugin.js";

export interface AppConfig {
  minSupportedClientVersion: number;
  sessionTtlDays: number;
  allowedOrigins: string[];
  appUrl: string;
  staticRoot: string | null;
  clientIpHeader: string | null;
  sampleShareTokens: readonly ShareToken[];
  supportEmail: string;
}

export interface AudioSetup {
  narrator: Narrator;
  store: AudioStore;
  concurrency: number;
  liveSlots: number;
  dollarsPerMachineHour: number | null;
  // Off in tests, which drain the queue themselves rather than race a background worker.
  runWorkers: boolean;
}

export interface TranscriptServiceSetup {
  fetches: ServiceFetches;
  proxyDailyFetches: number;
}

export interface OurKeySetup {
  apiKey: string;
  anthropicApiKey?: string | null;
  dailyGenerations: number;
  dailyChatMessages: number;
  http: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface MeaningSetup {
  embedder: Embedder;
  runWorkers: boolean;
}

export interface SpeechToTextSetup {
  transcriber: Transcriber;
  concurrency: number;
  runWorkers: boolean;
  sleep?: (ms: number) => Promise<void>;
}

export interface BuildAppOptions {
  config: AppConfig;
  sql: SqlClient;
  mailer: Mailer;
  audio?: AudioSetup | null;
  transcriptService?: TranscriptServiceSetup | null;
  speechToText?: SpeechToTextSetup | null;
  ourKey?: OurKeySetup | null;
  meaning?: MeaningSetup | null;
  fetchArticlePage?: ((url: string) => Promise<FetchedPage>) | undefined;
  readPodcastEpisode?: ((link: string) => Promise<PodcastRead>) | undefined;
  podcastWeb?: ReturnType<typeof createPublicWebFetch> | undefined;
  podcastIndex?: ShowDirectory | null;
  // Reads TikTok links and their captions through the vendor; absent, /api/tiktok says it is unavailable.
  tiktokReader?: TikTokReader | null;
  // Reads Instagram and Facebook posts through the vendor; absent, /api/social says it is unavailable.
  socialReader?: SocialPostReader | null;
  youTubeEpisodes?: YouTubeEpisodes | null;
  playlistReader?: PlaylistReader | null;
  videoReader?: VideoReader | null;
  eventSink?: EventSink | null;
  errorSink?: ErrorSink | null;
  personEraser?: PersonEraser | null;
  clock?: () => Date;
  logger?: FastifyBaseLogger | null;
  slowQueryMs?: number;
}

declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean;
    optionalSession?: boolean;
  }
  interface FastifyInstance {
    audioQueue: AudioRenderQueue | null;
    embeddingQueue: EmbeddingQueue | null;
    transcriptionQueue: TranscriptionQueue | null;
    questionRefresher: SuggestedQuestionRefresher | null;
  }
}

// Why the hooks run in this order: docs/architecture/api.md, "Versions on the wire".
export const buildApp = async ({
  config,
  sql: untimedSql,
  mailer,
  audio = null,
  transcriptService = null,
  speechToText = null,
  ourKey = null,
  meaning = null,
  playlistReader = null,
  videoReader = null,
  eventSink = null,
  errorSink = null,
  personEraser = null,
  clock = () => new Date(),
  logger = null,
  slowQueryMs = SLOW_QUERY_MS,
  fetchArticlePage = createArticlePageFetcher(),
  podcastWeb = createPublicWebFetch(),
  podcastIndex = null,
  youTubeEpisodes = null,
  readPodcastEpisode = createPodcastReader({ fetchPublicWeb: podcastWeb, appleBudget: APPLE_BUDGET, podcastIndex }),
  tiktokReader = null,
  socialReader = null,
}: BuildAppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    ...(logger === null ? { logger: false } : { loggerInstance: logger }),
    requestIdHeader: false,
    genReqId: requestIdFor,
    logController: new CodedLogController(),
  });
  trackCurrentRequest(app);
  app.addHook("onRequest", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
  const sql = timedSqlClient(untimedSql, { log: () => currentLog(app.log), slowMs: slowQueryMs });
  const sessionCookieSecure = config.appUrl.startsWith("https://");
  const urls = oauthUrls(config.appUrl);
  const audioRenders = new AudioRendersRepository(sql);
  const shares = new SharesRepository(sql, clock);
  const audioQueue =
    audio === null
      ? null
      : new AudioRenderQueue({
          renders: audioRenders,
          clock,
          log: app.log,
          ...audio,
          concurrency: Math.max(1, audio.concurrency - audio.liveSlots),
        });
  const chatSpeech =
    audio === null || audio.liveSlots === 0
      ? null
      : {
          lane: new LiveSpeechLane({ narrator: audio.narrator, slots: audio.liveSlots, clock }),
          dollarsPerMachineHour: audio.dollarsPerMachineHour,
        };
  app.decorate("audioQueue", audioQueue);
  const claimEmbeddings = new ClaimEmbeddingsRepository(sql);
  const costs = new AccountCostsRepository(sql);
  const embeddingQueue =
    meaning === null
      ? null
      : new EmbeddingQueue({
          embeddings: claimEmbeddings,
          embedder: meaning.embedder,
          costs,
          clock,
          log: app.log,
          runWorkers: meaning.runWorkers,
        });
  app.decorate("embeddingQueue", embeddingQueue);
  const transcriptionJobs = new PodcastTranscriptionsRepository(sql);
  const transcriptionQueue =
    speechToText === null ? null : new TranscriptionQueue({ jobs: transcriptionJobs, costs, clock, log: app.log, ...speechToText });
  app.decorate("transcriptionQueue", transcriptionQueue);
  const meaningSearch = meaning === null ? null : new MeaningSearch(claimEmbeddings, meaning.embedder, { costs, clock, log: app.log });
  const overviewsWritten = () => embeddingQueue?.kick();
  const questionRefresher =
    ourKey === null || meaning === null || ourKey.anthropicApiKey == null
      ? null
      : new SuggestedQuestionRefresher({
          apiKey: ourKey.apiKey,
          anthropicApiKey: ourKey.anthropicApiKey,
          http: ourKey.http,
          sql,
          records: new RecordsRepository(sql, clock),
          costs,
          embeddingModel: meaning.embedder.model,
          planOf: (accountId) => accountPlan(sql, accountId),
          clock,
          ...(ourKey.sleep === undefined ? {} : { sleep: ourKey.sleep }),
        });
  app.decorate("questionRefresher", questionRefresher);

  await app.register(
    async (api) => {
      registerApiErrorHandler(api, { errorSink, clock });
      if (config.allowedOrigins.length > 0) {
        await api.register(corsPlugin, { allowedOrigins: config.allowedOrigins });
      }
      await api.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
      api.addHook(
        "onRequest",
        rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock),
      );
      await api.register(clientVersionPlugin);
      await api.register(writeFloorPlugin, {
        minSupportedClientVersion: config.minSupportedClientVersion,
      });
      await api.register(sessionPlugin, {
        sql,
        clock,
        sessionTtlDays: config.sessionTtlDays,
        sessionCookieSecure,
      });
      api.addHook(
        "onRequest",
        rateLimitHook(rateLimits.perAccount, (request) => request.session?.accountId ?? null, clock),
      );

      healthRoutes(api, sql);
      handshakeRoutes(api, config.minSupportedClientVersion);
      sessionRoutes(api, {
        sql,
        clock,
        mailer,
        appUrl: config.appUrl,
        supportEmail: config.supportEmail,
        sessionCookieSecure,
        narrationStore: audio?.store ?? null,
        personEraser,
      });
      authRoutes(api, {
        sql,
        clock,
        mailer,
        appUrl: config.appUrl,
        sessionTtlDays: config.sessionTtlDays,
        sessionCookieSecure,
        eventSink,
      });
      connectionRoutes(api, { sql, clock, urls });

      const records = new RecordsRepository(sql, clock, overviewsWritten);
      changesRoutes(api, records);
      const transcripts = new TranscriptsRepository(sql, clock);
      const overviewUsage = new OverviewUsageRepository(sql);
      const captureSaves = new CaptureSavesRepository(sql);
      const captureClaims = new CaptureClaimsRepository(sql);
      const reservations = new OverviewReservationsRepository(sql, overviewUsage);
      const trials = new TrialsRepository(sql);
      overviewRoutes(api, records, transcripts, reservations);
      topicRoutes(api, records);
      meaningSearchRoutes(api, meaningSearch);
      transcriptSearchRoutes(api, { passages: new TranscriptPassagesRepository(sql), records, transcripts });
      followedPlaylistRoutes(api, records);
      projectRoutes(api, records);
      suggestedQuestionRoutes(api, records, questionRefresher);
      captureRoutes(api, { records, transcripts, saves: captureSaves, claims: captureClaims, sql, clock });
      playlistRoutes(api, { reader: playlistReader, clock });
      articleRoutes(api, { fetchPage: fetchArticlePage, trials, clock });
      settingsRoutes(api, records);
      const transcriptions =
        transcriptionQueue === null
          ? null
          : createPodcastTranscriptions({ fetchPublicWeb: podcastWeb, jobs: transcriptionJobs, queue: transcriptionQueue, clock });
      overviewUsageRoutes(api, { usage: overviewUsage, saves: captureSaves, transcriptions, sql, clock });
      overviewReservationRoutes(api, { reservations, usage: overviewUsage, shares, sql, clock });
      const chatUsage = new ChatUsageRepository(sql);
      chatRoutes(api, {
        records,
        libraryAnswerer:
          ourKey === null
            ? null
            : new LibraryChatAnswerer({
                apiKey: ourKey.apiKey,
                http: ourKey.http,
                dailyMessages: ourKey.dailyChatMessages,
                records,
                passages: new TranscriptPassagesRepository(sql),
                transcripts,
                usage: chatUsage,
                costs,
                clock,
                ...(ourKey.sleep === undefined ? {} : { sleep: ourKey.sleep }),
              }),
        answerer:
          ourKey === null
            ? null
            : new ChatAnswerer({
                apiKey: ourKey.apiKey,
                http: ourKey.http,
                dailyMessages: ourKey.dailyChatMessages,
                records,
                transcripts,
                usage: chatUsage,
                costs,
                meaningSearch,
                passages: new TranscriptPassagesRepository(sql),
                clock,
                ...(ourKey.sleep === undefined ? {} : { sleep: ourKey.sleep }),
              }),
        usage: chatUsage,
        sql,
        clock,
      });
      chatSpeechRoutes(api, { speech: chatSpeech, records, usage: chatUsage, costs, sql, clock });
      const generator = ourKey === null ? null : new OurKeyGenerator({ ...ourKey, usage: overviewUsage, reservations, costs, clock });
      generationRoutes(api, {
        generator,
        trials,
        sql,
        clock,
      });
      const youTubeService =
        transcriptService === null
          ? null
          : new ServiceTranscripts({ ...transcriptService, usage: new ServiceUsageRepository(sql), costs, clock });
      videoRoutes(api, {
        reader: videoReader,
        generator,
        service: youTubeService,
        kinds: new VideoKindsRepository(sql),
        trials,
        sql,
        clock,
      });
      const podcastTranscripts = createPodcastTranscripts({
        fetchPublicWeb: podcastWeb,
        sources: new EpisodeWordSourcesRepository(sql),
        youTubeService,
        youTubeEpisodes,
        clock,
      });
      transcriptRoutes(api, {
        transcripts,
        episodeWords: async (key, accountId, log) =>
          podcastTranscripts.remembered(key, { accountId, plan: await accountPlan(sql, accountId) }, log),
        videoWords: async (videoId, accountId, log) =>
          youTubeService === null
            ? null
            : youTubeService
                .resolve(videoId, { accountId, plan: await accountPlan(sql, accountId) }, log)
                .then((answer) => answer.transcript)
                .catch(() => null),
      });
      serviceTranscriptRoutes(api, { usage: overviewUsage, saves: captureSaves, service: youTubeService, sql, clock });
      const planOf = (accountId: AccountId): Promise<Plan> => accountPlan(sql, accountId);
      podcastRoutes(api, {
        readEpisode: readPodcastEpisode,
        resolveTranscript: podcastTranscripts.resolve,
        checkTranscript: podcastTranscripts.check,
        planOf,
        trials,
        transcriptions,
        clock,
      });
      tiktokRoutes(api, { reader: tiktokReader, transcriptions, planOf, costs, trials, clock });
      socialRoutes(api, { reader: socialReader, transcriptions, planOf, costs, trials, clock });
      shareRoutes(api, shares, config.appUrl);
      sampleRoutes(api, shares, config.sampleShareTokens);
      eventRoutes(api, { sink: eventSink, records, clock });
      sharedPageEventRoutes(api, { shares, sink: eventSink, clock });
      errorRoutes(api, errorSink, clock);
      feedbackRoutes(api, sql, clock);
      audioRoutes(
        api,
        audio === null || audioQueue === null
          ? null
          : { renders: audioRenders, queue: audioQueue, store: audio.store, samples: new VoiceSamplesRepository(sql) },
        clock,
      );
    },
    { prefix: "/api" },
  );

  await app.register(async (oauth) => {
    registerOAuthErrorHandler(oauth, { errorSink, clock });
    registerFormBodyParser(oauth);
    await oauth.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
    oauth.addHook(
      "onRequest",
      rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock),
    );
    oauthRoutes(oauth, { sql, clock, urls });
  });

  await app.register(async (mcp) => {
    registerMcpErrorHandler(mcp, { errorSink, clock });
    await mcp.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
    mcp.addHook(
      "onRequest",
      rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock),
    );
    await mcp.register(connectionAccessPlugin, { sql, clock, urls });
    mcp.addHook(
      "onRequest",
      rateLimitHook(rateLimits.mcpPerAccount, (request) => request.connectionAccess?.accountId ?? null, clock),
    );
    mcpRoutes(mcp, {
      sql,
      transcripts: new TranscriptsRepository(sql, clock),
      records: new RecordsRepository(sql, clock, overviewsWritten),
      meaning: meaningSearch,
      clock,
      appOrigin: new URL(config.appUrl).origin,
    });
  });

  app.addHook("onReady", async () => {
    audioQueue?.kick();
    embeddingQueue?.kick();
    transcriptionQueue?.kick();
  });

  await app.register(
    async (page) => {
      registerApiErrorHandler(page, { errorSink, clock });
      await page.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
      page.addHook(
        "onRequest",
        rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock),
      );
      await sharePagePlugin(page, { shares, appUrl: config.appUrl, staticRoot: config.staticRoot, clock });
    },
    { prefix: "/s" },
  );

  if (config.staticRoot !== null) {
    await app.register(webAppPlugin, { root: config.staticRoot });
  }

  return app;
};
