import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import {
  CLIENT_VERSION,
  CURRENT_SCHEMA_VERSIONS,
  chatRecordId,
  type Chat,
  type ChatCitation,
  type ChatAnswerSections,
  type ChatMessage,
  type ChatOwner,
  type ChatScopeStats,
  type ChatSource,
  type ChatUsage,
  DEFAULT_NARRATION_VOICE,
  NarrationVoice,
  narrationKeySource,
  shareContentSource,
  shareSnapshot,
  ShareToken,
  spokenScript,
  type NarrationRender,
  type AnalyticsDeclined,
  type AnalyticsEventBatch,
  type SharedPageEventBatch,
  type ClientErrorBatch,
  type FollowedPlaylist,
  type PlaylistCheck,
  type PlaylistLookup,
  type QueuedCapture,
  type Project,
  type ProjectMember,
  type ProjectId,
  TRIAL_TOKEN_HEADER,
  type AuthSurface,
  type Connection,
  type ConnectionRequest,
  type Plan,
  type MagicLinkRequest,
  type ArticleRead,
  type VideoRead,
  type PodcastRead,
  type TikTokRead,
  type PodcastTranscription,
  type TranscriptCheck,
  type TranscriptionUsage,
  type OurKeyGenerationRequest,
  type ProfilePassInput,
  type ProfilePassItem,
  type OverviewUsage,
  type OutboxEntry,
  type Overview,
  type OverviewId,
  type OverviewState,
  type RecordChange,
  type Share,
  type SharedOverview,
  type ShareRequest,
  type StoredTranscript,
  type Topic,
  type TopicMatchInput,
  type TopicSuggestionInput,
  type TopicSuggestionResult,
  type UnreadableRecord,
  type VideoId,
  youTubeSource,
  type TranscriptSearchResponse,
} from "@overview/domain";
import { EndpointBehaviour, EndpointKey } from "./EndpointKey.testHelper.js";
import type { IwftHooksConfig } from "./IwftHooksConfig.testHelper.js";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import {
  fittedToTheAsk,
  makeAnthropicMessageResponse,
  makeGeneratedOutputFixture,
  makeModelListResponse,
} from "./fixtures/anthropicFixtures.js";
import {
  IWFT_VIDEO_ID,
  makeJson3Fixture,
  makeMicroformatFixture,
  makePlayerResponseFixture,
  makeServiceTranscriptFixture,
} from "./fixtures/innerTubeFixtures.js";
import type {} from "./iwftWindow.testHelper.js";

// Mirrors apps/api/src/usage/overviewQuotas.ts.
const SIMULATED_QUOTAS: Record<Plan, { ours: number; own: number }> = {
  free: { ours: 5, own: 10 },
  "byo-plus": { ours: 10, own: 200 },
  plus: { ours: 50, own: 200 },
};

export const SIMULATED_ACCOUNT_ID = "account";
export const SIMULATED_EMAIL = "reader@example.com";
export const SIMULATED_OUR_MODEL = { provider: "openai", model: "gpt-6.1-sol" } as const;
export const SIMULATED_LINK_CODE = "ABCD-EFGH";
export const SIMULATED_BEARER = "linked-session-token";
export const SIMULATED_SAMPLE_TITLE = "A Sample To Start From";

export const SIMULATED_ASSISTANT_CALLBACK = "https://assistant.test/callback";

export const SIMULATED_SECONDS_PER_LINE = 2;

const SAMPLE_SECONDS = 20;

const keyFor = (lines: string[], voice: string) => createHash("sha256").update(narrationKeySource(lines, voice)).digest("hex");

const readyRender = (key: string, lineCount: number, secondsPerLine = SIMULATED_SECONDS_PER_LINE): NarrationRender => ({
  key,
  status: "ready",
  lineStartsSeconds: Array.from({ length: lineCount }, (_, index) => index * secondsPerLine),
  durationSeconds: lineCount * secondsPerLine,
  fileUrl: `/api/audio/${key}/file`,
});

// Headless Chromium can't decode the real M4A, so the simulated file is silent 8-bit WAV.
const silentWav = (seconds: number): Buffer => {
  const sampleRate = 8000;
  const samples = Math.round(seconds * sampleRate);
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(samples, 40);
  return wav;
};

interface SimulatedResponse {
  status: number;
  body?: unknown;
  stream?: unknown[];
}

const fulfil = (route: Route, { status, body, stream }: SimulatedResponse): Promise<void> =>
  stream === undefined
    ? route.fulfill({ status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(body) })
    : route.fulfill({
        status,
        contentType: "text/event-stream",
        body: stream.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });

export interface ChatAnswerReply {
  text: string;
  citations?: ChatCitation[];
  inSource?: boolean;
  found?: Array<{ overviewId: OverviewId; title: string }>;
  sections?: ChatAnswerSections;
  picked?: Array<{ overviewId: OverviewId; title: string }>;
  stats?: ChatScopeStats;
}

export interface ChatQuestionSent {
  // An overview's id, or "library", or "project:<id>" for a question on the Ask page.
  overviewId: string;
  conversationId: string;
  text: string;
  pins?: { overviews: string[]; projects: string[] };
  setAside?: string[];
  searchLibrary?: boolean;
}

type ChatReply =
  | ({ kind: "answer" } & ChatAnswerReply)
  | { kind: "failed" }
  | { kind: "refused"; status: number; error: { code: string; message?: string; details?: Record<string, unknown> } };

const DEFAULT_CHAT_REPLY: ChatReply = {
  kind: "answer",
  text: "People who took creatine while strength training gained more lean mass than people who trained without it.",
  citations: [{ startMs: 208_000, endMs: 263_000 }],
  inSource: true,
};

const chatChange = ({ id, ...body }: Chat & { rev?: number }, rev: number, seq: number): RecordChange => {
  const { rev: _, ...stored } = body as typeof body & { rev?: number };
  return {
    kind: "chat",
    id,
    schemaVersion: CURRENT_SCHEMA_VERSIONS.chat,
    rev,
    seq,
    updatedAt: new Date().toISOString(),
    deleted: false,
    body: stored,
  };
};

export class BackendSimulator {
  #page: Page;
  #seedOverviews: Overview[] = [];
  #seedStates: OverviewState[] = [];
  #seedTopics: Topic[] = [];
  #seedTranscripts: StoredTranscript[] = [];
  #seedUnreadable: UnreadableRecord[] = [];

  #behaviours = new Map<EndpointKey, EndpointBehaviour>(Object.values(EndpointKey).map((key) => [key, EndpointBehaviour.DEFAULT]));
  #callCounts = new Map<EndpointKey, number>();
  #shares = new Map<string, Share>();
  #shareSnapshots = new Map<string, SharedOverview>();
  #nextShareToken = 0;
  #startSamples: ShareToken[] = [];
  #stalled: Array<{
    endpoint: EndpointKey;
    route: Route;
    onDefault: () => SimulatedResponse;
  }> = [];
  // Answered in turn, then the default: docs/features/chats.md, "Asking".
  #chatReplies: ChatReply[] = [];
  #chatQuestions: ChatQuestionSent[] = [];
  #chatRecords = new Map<string, Chat & { rev: number }>();
  #chatUsage: ChatUsage = { plan: "free", resetsOn: "2026-10-01", used: 0, limit: 100, share: 0, libraryFits: true };
  #generatedOutputOverrides: Record<string, unknown> = {};
  #feed: RecordChange[] = [];
  #accountTranscripts = new Map<string, StoredTranscript>();
  #sharedTranscripts = new Map<string, StoredTranscript>();
  #serviceTranscripts: Map<string, StoredTranscript> | null = new Map([[IWFT_VIDEO_ID, makeServiceTranscriptFixture()]]);
  #serviceRefusal: { daily: boolean; retryAfterSeconds: number } | null = null;
  #minSupportedClientVersion = 1;
  #magicLinkRequests: MagicLinkRequest[] = [];
  #signInAttempts: string[] = [];
  #emailCodeAttempts: { email: string; code: string }[] = [];
  #linkCodeServers: string[] = [];
  #linkSurface: AuthSurface = "web";
  #accountFirstName: string | null = null;
  #accountEmail: string = SIMULATED_EMAIL;
  #verificationRequired = true;
  #newAddressTaken = false;
  #revertRefusal: { reason: "expired" | "spent" | "taken"; email?: string } | null = null;
  #namesSaved: Array<string | null> = [];
  #verificationAsks = 0;
  #verificationPurposes: string[] = [];
  #verificationCodes: string[] = [];
  #accountDeletions = 0;
  #deleteNeedsVerification = false;
  #emailChangeAsks: string[] = [];
  #emailChangeCodes: string[] = [];
  #revertTokens: string[] = [];
  #sessionHasEnded = false;
  #accountPlan: Plan = "free";
  // Off by default: docs/architecture/tiers.md, "Generating on our key".
  #ourKeyAvailable = false;
  #ourKeyRefusal: { status: number; code: string; details: Record<string, unknown> } | null = null;
  #ownMonthSpent = false;
  #madeEarlierThisMonth = { ours: 0, own: 0 };
  #anthropicOutOfCredit = false;
  #anthropicRefusesModel = false;
  #ourKeyRequests: OurKeyGenerationRequest[] = [];
  #profilePassItems: ProfilePassItem[] = [];
  #profilePasses: ProfilePassInput[] = [];
  #ourKeyHowToApply: string[] | null = null;
  #ourKeyFilesInto: string[] = [];
  #topicMatches: string[] = [];
  #topicPasses: TopicMatchInput[] = [];
  #topicSuggestion: TopicSuggestionResult | null = null;
  #topicSuggestionsHeld = false;
  #topicSuggestionsAsked: Array<{ input: TopicSuggestionInput; trialToken: string | null }> = [];
  #articleReads: string[] = [];
  #articleReadTrialTokens: Array<string | null> = [];
  #articleReadsSpent: "trial-reads" | "trial-reads-address" | null = null;
  #articleAnswer: ArticleRead = { status: "failed", reason: "nothing-readable" };
  #podcastAnswer: PodcastRead = { status: "failed", reason: "not-an-episode" };
  #tiktokAnswer: TikTokRead | "unavailable" = "unavailable";
  #tiktokReads: string[] = [];
  #podcastWords: StoredTranscript | null = null;
  #podcastReads: string[] = [];
  #videoReads: string[] = [];
  #videoAnswer: VideoRead | null = null;
  #podcastReadsHeld: Array<() => void> | null = null;
  #podcastTranscriptAsks: Array<{ feedUrl: string; guid: string }> = [];
  #podcastCheck: TranscriptCheck | null = null;
  #podcastTranscribable = false;
  #transcriptionScript: PodcastTranscription[] = [];
  #transcriptionAsks: Array<{ feedUrl: string; guid: string }> = [];
  #tiktokTranscriptionAsks: string[] = [];
  #transcriptionUsage: TranscriptionUsage | undefined = undefined;
  #trialTokensIssued = 0;
  #trialTokensSent: Array<string | null> = [];
  #reservations: Array<{ overviewId: string; shareToken?: string }> = [];
  #releases: string[] = [];
  #sessionLapsed = false;
  #connectionRequest: ConnectionRequest | null = null;
  #decisions: Array<{ requestId: string; approve: boolean }> = [];
  #connections: Connection[] = [];
  #revoked: string[] = [];
  #renders = new Map<string, { render: NarrationRender; lineCount: number }>();
  #narrationBusy = false;
  #narrationDailyCapSpent = false;
  #narrationPriorities: string[] = [];
  #narrationVoices: string[] = [];
  #samples: Array<{ voice: string; key: string }> = [];
  #eventBatches: AnalyticsEventBatch[] = [];
  #declines: AnalyticsDeclined[] = [];
  #sharedPageEventBatches: Array<{ token: string; batch: SharedPageEventBatch }> = [];
  #errorBatches: ClientErrorBatch[] = [];
  #playlists = new Map<string, PlaylistLookup | "private">();
  #meaningMatches = new Map<string, string[]>();
  #transcriptMatches = new Map<string, TranscriptSearchResponse["matches"]>();
  #seedFollowed: FollowedPlaylist[] = [];
  #seedChecks: PlaylistCheck[] = [];
  #seedQueue: QueuedCapture[] = [];
  #seedProjects: Project[] = [];
  #seedProjectMembers: ProjectMember[] = [];

  constructor(page: Page) {
    this.#page = page;
    this.startSamples.offer(
      makeOverview({ source: { ...makeOverview().source, title: SIMULATED_SAMPLE_TITLE, durationMs: 754_000 } }),
      makeArticleOverview(),
      makeRecipeOverview(),
    );
  }

  simulateEndpointDefault = (endpoint: EndpointKey): void => {
    this.#behaviours.set(endpoint, EndpointBehaviour.DEFAULT);
  };
  simulateEndpointError = (endpoint: EndpointKey): void => {
    this.#behaviours.set(endpoint, EndpointBehaviour.ERROR);
  };
  simulateEndpointStalled = (endpoint: EndpointKey): void => {
    this.#behaviours.set(endpoint, EndpointBehaviour.STALL);
  };
  getCallCount = (endpoint: EndpointKey): number => this.#callCounts.get(endpoint) ?? 0;

  // The only way to drive a multi-step pipeline a step at a time without racing it.
  releaseEndpoint = async (endpoint: EndpointKey): Promise<void> => {
    const held = this.#stalled.filter((entry) => entry.endpoint === endpoint);
    this.#stalled = this.#stalled.filter((entry) => entry.endpoint !== endpoint);
    this.simulateEndpointDefault(endpoint);
    for (const { route, onDefault } of held) {
      await fulfil(route, onDefault());
    }
  };

  setGeneratedOutputOverrides = (overrides: Record<string, unknown>): void => {
    this.#generatedOutputOverrides = overrides;
  };

  // Playwright CT's hooksConfig is the only channel into the browser-side stores.
  buildHooksConfig = (): Omit<IwftHooksConfig, "apiKeys"> => ({
    seedOverviews: this.#seedOverviews,
    seedStates: this.#seedStates,
    seedUnreadable: this.#seedUnreadable,
    seedTopics: this.#seedTopics,
    seedTranscripts: this.#seedTranscripts,
    seedFollowedPlaylists: this.#seedFollowed,
    seedPlaylistChecks: this.#seedChecks,
    seedQueue: this.#seedQueue,
    seedProjects: this.#seedProjects,
    seedProjectMembers: this.#seedProjectMembers,
  });

  handleNetworking = async (): Promise<void> => {
    await this.#handleSyncNetworking();
    // The WEB client only asks for a publish date, so it is not counted.
    await this.#page.route("**/www.youtube.com/youtubei/v1/player**", (route) => {
      const isMetadataClient = route.request().headers()["x-youtube-client-name"]?.toUpperCase() === "WEB";
      if (isMetadataClient) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(makeMicroformatFixture()),
        });
      }
      return this.#respond(route, EndpointKey.INNERTUBE_PLAYER, {
        onDefault: () => ({ status: 200, body: makePlayerResponseFixture() }),
        // 500, not ERROR: ERROR is a fact about the video and would stop the ladder.
        onError: () => ({ status: 500, body: { error: "Simulated player failure" } }),
      });
    });

    await this.#page.route("**/www.youtube.com/api/timedtext**", (route) =>
      this.#respond(route, EndpointKey.YOUTUBE_TIMEDTEXT, {
        onDefault: () => ({ status: 200, body: makeJson3Fixture() }),
        // An empty track is a gated one, not a video without captions.
        onError: () => ({ status: 200, body: { events: [] } }),
      }),
    );

    // Matched by path, not host: the providers differ only in origin.
    await this.#page.route(/\/(v1\/)?models(\?|$)/, (route) =>
      this.#respond(route, EndpointKey.PROVIDER_MODELS, {
        onDefault: () => ({ status: 200, body: makeModelListResponse() }),
        // A refused key, which is the one failure with a screen of its own (design 110f).
        onError: () => ({ status: 401, body: { error: { message: "Simulated: no such key" } } }),
      }),
    );

    await this.#page.route("**/api.anthropic.com/v1/messages**", (route) =>
      this.#respond(route, EndpointKey.ANTHROPIC_MESSAGES, {
        onDefault: () => {
          if (this.#anthropicRefusesModel) {
            return {
              status: 400,
              body: {
                type: "error",
                error: {
                  type: "invalid_request_error",
                  message: "The compiled grammar is too large, which would cause performance issues.",
                },
              },
            };
          }
          if (this.#anthropicOutOfCredit) {
            return {
              status: 400,
              body: {
                type: "error",
                error: {
                  type: "invalid_request_error",
                  message:
                    "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
                },
              },
            };
          }
          return {
            status: 200,
            body: makeAnthropicMessageResponse(
              route.request().postData()?.includes('"noteKind"')
                ? { noteKind: this.#generatedOutputOverrides.recipe ? "recipe" : "default" }
                : fittedToTheAsk(makeGeneratedOutputFixture(this.#generatedOutputOverrides), route.request().postData() ?? ""),
            ),
          };
        },
        onError: () => ({
          status: 401,
          body: {
            type: "error",
            error: { type: "authentication_error", message: "Simulated auth failure" },
          },
        }),
      }),
    );
  };

  #ourKeyOverviewFor = (request: OurKeyGenerationRequest) => {
    if ("podcast" in request.input) {
      return makeOverview({ id: request.overviewId, source: request.input.podcast, inOneLine: "Made from the episode." });
    }
    if ("article" in request.input) {
      return { ...makeArticleOverview({ id: request.overviewId }), inOneLine: "Made from the article." };
    }
    return makeOverview({
      id: request.overviewId,
      source: youTubeSource(request.input.video),
      inOneLine: "Made on our key.",
      ...(this.#ourKeyHowToApply === null ? {} : { howToApply: { items: this.#ourKeyHowToApply } }),
    });
  };

  #handleSyncNetworking = async (): Promise<void> => {
    const unauthenticated = () => ({
      status: 401,
      body: { error: { code: "unauthenticated", message: "Simulated: no such session" } },
    });
    const spent = () => ({
      status: 410,
      body: { error: { code: "link_invalid", message: "Simulated: spent" } },
    });
    const expiresAt = "2026-10-26T09:00:00.000Z";

    await this.#page.route("**/api/auth/magic-link", (route) =>
      this.#respond(route, EndpointKey.AUTH_MAGIC_LINK, {
        onDefault: () => {
          this.#magicLinkRequests.push(route.request().postDataJSON() as MagicLinkRequest);
          return { status: 202, body: { accepted: true } };
        },
        onError: () => ({
          status: 400,
          body: { error: { code: "invalid_request", message: "Simulated: not an email address" } },
        }),
      }),
    );

    await this.#page.route("**/api/auth/sign-in", (route) =>
      this.#respond(route, EndpointKey.AUTH_SIGN_IN, {
        onDefault: () => {
          this.#signInAttempts.push((route.request().postDataJSON() as { token: string }).token);
          return {
            status: 200,
            body:
              this.#linkSurface === "extension"
                ? {
                    surface: "extension",
                    email: SIMULATED_EMAIL,
                    firstName: this.#accountFirstName,
                    linkCode: SIMULATED_LINK_CODE,
                    linkCodeExpiresAt: "2026-09-26T09:10:00.000Z",
                  }
                : {
                    surface: "web",
                    accountId: SIMULATED_ACCOUNT_ID,
                    email: SIMULATED_EMAIL,
                    firstName: this.#accountFirstName,
                    expiresAt,
                  },
          };
        },
        onError: spent,
      }),
    );

    await this.#page.route("**/api/auth/email-code", (route) =>
      this.#respond(route, EndpointKey.AUTH_EMAIL_CODE, {
        onDefault: () => {
          this.#emailCodeAttempts.push(route.request().postDataJSON() as { email: string; code: string });
          return {
            status: 200,
            body: {
              surface: "web",
              accountId: SIMULATED_ACCOUNT_ID,
              email: SIMULATED_EMAIL,
              firstName: this.#accountFirstName,
              expiresAt,
            },
          };
        },
        onError: spent,
      }),
    );

    await this.#page.route("**/api/auth/link-code", (route) =>
      this.#respond(route, EndpointKey.AUTH_LINK_CODE, {
        onDefault: () => {
          this.#linkCodeServers.push(new URL(route.request().url()).origin);
          return {
            status: 200,
            body: {
              token: SIMULATED_BEARER,
              accountId: SIMULATED_ACCOUNT_ID,
              email: SIMULATED_EMAIL,
              firstName: this.#accountFirstName,
              expiresAt,
            },
          };
        },
        onError: spent,
      }),
    );

    await this.#page.route("**/api/session/link-code", (route) =>
      this.#respond(route, EndpointKey.SESSION_LINK_CODE, {
        onDefault: () => ({
          status: 200,
          body: { linkCode: SIMULATED_LINK_CODE, linkCodeExpiresAt: "2026-09-26T09:10:00.000Z" },
        }),
        onError: () =>
          this.#sessionHasEnded
            ? unauthenticated()
            : { status: 503, body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } } },
      }),
    );

    const sessionInfo = () => ({
      accountId: SIMULATED_ACCOUNT_ID,
      email: this.#accountEmail,
      firstName: this.#accountFirstName,
      expiresAt,
      plan: this.#accountPlan,
    });
    const limited = () => ({
      status: 429,
      body: { error: { code: "too_many_requests", message: "Simulated: too many", details: { retryAfterSeconds: 4080 } } },
    });
    const codeMatches = (code: string) => code.toUpperCase().replace(/[^A-Z2-9]/g, "") === SIMULATED_LINK_CODE.replace("-", "");
    const codeExpiry = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await this.#page.route("**/api/session/account", (route) =>
      route.request().method() === "DELETE"
        ? this.#respond(route, EndpointKey.SESSION_ACCOUNT_DELETE, {
            onDefault: () => {
              if (this.#deleteNeedsVerification) {
                this.#deleteNeedsVerification = false;
                return { status: 403, body: { error: { code: "verification_required", message: "Simulated: confirm it’s you first" } } };
              }
              this.#accountDeletions += 1;
              this.#sessionLapsed = true;
              return { status: 204, body: undefined };
            },
            onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } } }),
          })
        : this.#respond(route, EndpointKey.SESSION_ACCOUNT, {
            onDefault: () => {
              const { firstName } = route.request().postDataJSON() as { firstName: string | null };
              this.#namesSaved.push(firstName);
              this.#accountFirstName = firstName;
              return { status: 200, body: sessionInfo() };
            },
            onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } } }),
          }),
    );

    await this.#page.route("**/api/session/verification", (route) =>
      this.#respond(route, EndpointKey.SESSION_VERIFICATION, {
        onDefault: () => {
          this.#verificationAsks += 1;
          this.#verificationPurposes.push((route.request().postDataJSON() as { purpose?: string } | null)?.purpose ?? "emailChange");
          return this.#verificationRequired
            ? { status: 200, body: { required: true, email: this.#accountEmail, expiresAt: codeExpiry() } }
            : { status: 200, body: { required: false } };
        },
        onError: limited,
      }),
    );

    await this.#page.route("**/api/session/verification/confirm", (route) =>
      this.#respond(route, EndpointKey.SESSION_VERIFICATION_CONFIRM, {
        onDefault: () => {
          const { code } = route.request().postDataJSON() as { code: string };
          this.#verificationCodes.push(code);
          return codeMatches(code) ? { status: 204, body: undefined } : spent();
        },
        onError: spent,
      }),
    );

    await this.#page.route("**/api/session/email-change", (route) =>
      this.#respond(route, EndpointKey.SESSION_EMAIL_CHANGE, {
        onDefault: () => {
          const { email } = route.request().postDataJSON() as { email: string };
          this.#emailChangeAsks.push(email);
          return { status: 202, body: { accepted: true, expiresAt: codeExpiry() } };
        },
        onError: limited,
      }),
    );

    await this.#page.route("**/api/session/email-change/confirm", (route) =>
      this.#respond(route, EndpointKey.SESSION_EMAIL_CHANGE_CONFIRM, {
        onDefault: () => {
          const { code } = route.request().postDataJSON() as { code: string };
          this.#emailChangeCodes.push(code);
          if (!codeMatches(code)) {
            return spent();
          }
          if (this.#newAddressTaken) {
            return { status: 409, body: { error: { code: "already_exists", message: "Simulated: taken" } } };
          }
          this.#accountEmail = this.#emailChangeAsks.at(-1) ?? this.#accountEmail;
          return { status: 200, body: sessionInfo() };
        },
        onError: spent,
      }),
    );

    await this.#page.route("**/api/auth/email-change/revert", (route) =>
      this.#respond(route, EndpointKey.AUTH_EMAIL_CHANGE_REVERT, {
        onDefault: () => {
          const { token } = route.request().postDataJSON() as { token: string };
          this.#revertTokens.push(token);
          const refusal = this.#revertRefusal;
          return refusal === null
            ? { status: 200, body: { email: SIMULATED_EMAIL } }
            : { status: 410, body: { error: { code: "link_invalid", message: "Simulated: refused", details: refusal } } };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } } }),
      }),
    );

    await this.#page.route("**/api/session", (route) =>
      route.request().method() === "DELETE"
        ? this.#respond(route, EndpointKey.SESSION_DELETE, {
            onDefault: () => ({ status: 204, body: undefined }),
            onError: unauthenticated,
          })
        : this.#respond(route, EndpointKey.SESSION_READ, {
            onDefault: () => (this.#sessionLapsed ? unauthenticated() : { status: 200, body: sessionInfo() }),
            onError: () => ({
              status: 503,
              body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
            }),
          }),
    );

    await this.#handleConnectionNetworking();
    await this.#handleSampleNetworking();
    await this.#handleAnalyticsNetworking();

    await this.#page.route("**/api/handshake", (route) =>
      this.#respond(route, EndpointKey.SYNC_HANDSHAKE, {
        onDefault: () => ({
          status: 200,
          body: { minSupportedClientVersion: this.#minSupportedClientVersion, currentClientVersion: CLIENT_VERSION },
        }),
        onError: unauthenticated,
      }),
    );

    await this.#page.route("**/api/transcripts/*", (route) =>
      this.#respond(route, EndpointKey.SYNC_TRANSCRIPT, {
        onDefault: () => {
          const videoId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          if (route.request().method() === "PUT") {
            this.#accountTranscripts.set(videoId, route.request().postDataJSON() as StoredTranscript);
            return { status: 204, body: undefined };
          }
          const held = this.#accountTranscripts.get(videoId);
          return held === undefined
            ? { status: 404, body: { error: { code: "not_found", message: "Simulated: no transcript kept" } } }
            : { status: 200, body: held };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );

    await this.#page.route("**/api/shares", (route) =>
      route.request().method() === "POST"
        ? this.#respond(route, EndpointKey.SHARE_CREATE, {
            onDefault: () => this.#putShare(route.request().postDataJSON() as ShareRequest),
            onError: () => ({
              status: 503,
              body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
            }),
          })
        : this.#respond(route, EndpointKey.SHARE_LIST, {
            onDefault: () => ({ status: 200, body: { shares: [...this.#shares.values()] } }),
            onError: unauthenticated,
          }),
    );

    await this.#page.route("**/api/shares/*", (route) =>
      this.#respond(route, EndpointKey.SHARE_STOP, {
        onDefault: () => {
          const token = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          return this.#shares.delete(token)
            ? { status: 204, body: undefined }
            : { status: 404, body: { error: { code: "not_found", message: "Simulated: no live link" } } };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );

    await this.#page.route("**/api/shared-transcripts/*", (route) =>
      this.#respond(route, EndpointKey.SHARED_TRANSCRIPT, {
        onDefault: () => {
          const videoId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          const held = this.#sharedTranscripts.get(videoId);
          return held === undefined
            ? { status: 404, body: { error: { code: "not_found", message: "Simulated: not in the shared cache" } } }
            : { status: 200, body: held };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );

    await this.#page.route("**/api/search/meaning?*", (route) =>
      this.#respond(route, EndpointKey.MEANING_SEARCH, {
        onDefault: () => {
          const query = new URL(route.request().url()).searchParams.get("query") ?? "";
          const ids = this.#meaningMatches.get(query) ?? [];
          return {
            status: 200,
            body: { available: true, matches: ids.map((overviewId, index) => ({ overviewId, similarity: 0.6 - index / 100 })) },
          };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: meaning search failed" } } }),
      }),
    );

    await this.#page.route("**/api/search/transcripts?*", (route) =>
      this.#respond(route, EndpointKey.TRANSCRIPT_SEARCH, {
        onDefault: () => {
          const query = new URL(route.request().url()).searchParams.get("query") ?? "";
          return { status: 200, body: { matches: this.#transcriptMatches.get(query) ?? [] } };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: transcript search failed" } } }),
      }),
    );

    await this.#page.route("**/api/playlists/*", (route) =>
      this.#respond(route, EndpointKey.PLAYLIST_LOOKUP, {
        onDefault: () => {
          const playlistId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          const held = this.#playlists.get(playlistId);
          if (held === undefined) {
            return { status: 404, body: { error: { code: "playlist_not_found", message: "Simulated: no such playlist" } } };
          }
          if (held === "private") {
            return { status: 422, body: { error: { code: "playlist_private", message: "Simulated: that playlist is private" } } };
          }
          return { status: 200, body: held };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: this server does not read YouTube playlists" } },
        }),
      }),
    );

    await this.#page.route("**/api/service-transcripts", (route) =>
      this.#respond(route, EndpointKey.SERVICE_TRANSCRIPT_STATUS, {
        onDefault: () => ({ status: 200, body: { available: this.#serviceTranscripts !== null } }),
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the server is not reachable" } },
        }),
      }),
    );

    await this.#page.route("**/api/service-transcripts/*", (route) =>
      this.#respond(route, EndpointKey.SERVICE_TRANSCRIPT, {
        onDefault: () => {
          if (this.#serviceTranscripts === null) {
            return { status: 503, body: { error: { code: "unavailable", message: "Simulated: the service is off" } } };
          }
          if (this.#serviceRefusal !== null) {
            const { daily, retryAfterSeconds } = this.#serviceRefusal;
            return {
              status: 429,
              body: {
                error: {
                  code: "too_many_requests",
                  message: daily ? "Simulated: as many transcripts as our server fetches for you in a day" : "Simulated: too many requests",
                  details: { ...(daily ? { daily: true } : {}), retryAfterSeconds },
                },
              },
            };
          }
          const videoId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          const fetched = this.#serviceTranscripts.get(videoId);
          if (fetched === undefined) {
            return {
              status: 422,
              body: {
                error: { code: "transcript_unavailable", message: "this video has no captions", details: { failure: "no-captions" } },
              },
            };
          }
          return { status: 200, body: fetched };
        },
        onError: () => ({
          status: 422,
          body: {
            error: {
              code: "transcript_unavailable",
              message: "Simulated: our server has fetched all the transcripts it can for today.",
              details: { failure: "budget-exhausted" },
            },
          },
        }),
      }),
    );

    const unavailable = () => ({
      status: 503,
      body: { error: { code: "unavailable", message: "Simulated: narration is not set up" } },
    });

    await this.#page.route("**/api/audio", (route) =>
      this.#respond(route, EndpointKey.NARRATION_REQUEST, {
        onDefault: () => {
          const { lines, voice, priority } = route.request().postDataJSON() as {
            lines: string[];
            voice: string;
            priority: string;
          };
          this.#narrationPriorities.push(priority);
          this.#narrationVoices.push(voice);
          const key = keyFor(lines, voice);
          const held = this.#renders.get(key);
          if (held?.render.status === "ready") {
            return { status: 200, body: held.render };
          }
          if (this.#narrationDailyCapSpent) {
            return {
              status: 429,
              body: {
                error: {
                  code: "too_many_requests",
                  message: "Simulated: today's new narration is spent",
                  details: { quota: "narration-daily", limit: 30, retryAfterSeconds: 3600 },
                },
              },
            };
          }
          if (this.#narrationBusy) {
            return { status: 429, body: { error: { code: "too_many_requests", message: "Simulated: three waiting" } } };
          }
          const queued: NarrationRender = { key, status: "queued" };
          this.#renders.set(key, { render: queued, lineCount: lines.length });
          return { status: 202, body: queued };
        },
        onError: unavailable,
      }),
    );

    const notFound = { status: 404, body: { error: { code: "not_found", message: "Simulated: never asked for" } } };

    await this.#page.route("**/api/audio/*", (route) => {
      const key = new URL(route.request().url()).pathname.split("/").at(-1)!;
      if (route.request().method() === "DELETE") {
        return this.#respond(route, EndpointKey.NARRATION_DELETE, {
          onDefault: () => (this.#renders.delete(key) ? { status: 204, body: null } : notFound),
          onError: unavailable,
        });
      }
      return this.#respond(route, EndpointKey.NARRATION_STATUS, {
        onDefault: () => {
          const held = this.#renders.get(key);
          return held === undefined ? notFound : { status: 200, body: held.render };
        },
        onError: unavailable,
      });
    });

    // Registered after audio/*, which also matches them: Playwright tries the newest route first.
    await this.#page.route("**/api/audio/lookup", (route) =>
      this.#respond(route, EndpointKey.NARRATION_LOOKUP, {
        onDefault: () => {
          const { keys } = route.request().postDataJSON() as { keys: string[] };
          const renders = keys.flatMap((key) => {
            const held = this.#renders.get(key);
            return held === undefined ? [] : [held.render];
          });
          return { status: 200, body: { renders } };
        },
        onError: unavailable,
      }),
    );

    await this.#page.route("**/api/audio/samples", (route) =>
      this.#respond(route, EndpointKey.NARRATION_SAMPLES, {
        onDefault: () => ({
          status: 200,
          body: {
            samples: this.#samples.map(({ voice, key }) => ({
              voice,
              fileUrl: `/api/audio/${key}/file`,
              durationSeconds: SAMPLE_SECONDS,
            })),
          },
        }),
        onError: unavailable,
      }),
    );

    await this.#page.route("**/api/audio/*/file", (route) => {
      const key = new URL(route.request().url()).pathname.split("/").at(-2)!;
      const held = this.#renders.get(key);
      if (held?.render.status !== "ready") {
        return route.fulfill({ status: 404, body: "" });
      }
      // Byte ranges, as the real route serves them: a media element that can't ask for a range can't seek.
      const file = silentWav(held.render.durationSeconds);
      const range = /^bytes=(\d*)-(\d*)$/.exec(route.request().headers()["range"] ?? "");
      if (range === null) {
        return route.fulfill({ status: 200, contentType: "audio/wav", headers: { "accept-ranges": "bytes" }, body: file });
      }
      const start = range[1] === "" ? Math.max(0, file.length - Number(range[2])) : Number(range[1]);
      const end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
      return route.fulfill({
        status: 206,
        contentType: "audio/wav",
        headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${file.length}` },
        body: file.subarray(start, end + 1),
      });
    });

    const usage = (): OverviewUsage => {
      const limits = SIMULATED_QUOTAS[this.#accountPlan];
      const ownUsed = this.#madeEarlierThisMonth.own + this.#reservations.length - this.#releases.length;
      return {
        plan: this.#accountPlan,
        resetsOn: "2026-11-01",
        ours: { used: this.#madeEarlierThisMonth.ours + this.#ourKeyRequests.length, limit: limits.ours },
        own: { used: this.#ownMonthSpent ? limits.own : ownUsed, limit: limits.own },
        ...(this.#transcriptionUsage === undefined ? {} : { transcription: this.#transcriptionUsage }),
      };
    };

    await this.#page.route("**/api/articles/read", (route) => {
      this.#articleReads.push((route.request().postDataJSON() as { url: string }).url);
      this.#articleReadTrialTokens.push(route.request().headers()[TRIAL_TOKEN_HEADER] ?? null);
      if (this.#articleReadsSpent !== null) {
        return route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "too_many_requests", message: "Simulated: trial reads spent", details: { quota: this.#articleReadsSpent } },
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(this.#articleAnswer) });
    });

    await this.#page.route("**/api/videos/read", (route) => {
      const { videoId } = route.request().postDataJSON() as { videoId: string };
      this.#videoReads.push(videoId);
      const video = (this.#serviceTranscripts?.get(videoId) ?? makeServiceTranscriptFixture(videoId)).video!;
      const answer: VideoRead = this.#videoAnswer ?? { status: "read", video, noteKind: null, transcript: null };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer) });
    });

    await this.#page.route("**/api/tiktok/read", (route) => {
      this.#tiktokReads.push((route.request().postDataJSON() as { url: string }).url);
      return this.#tiktokAnswer === "unavailable"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "unavailable", message: "This server does not read TikTok links" } }),
          })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(this.#tiktokAnswer) });
    });

    await this.#page.route("**/api/podcasts/read", async (route) => {
      this.#podcastReads.push((route.request().postDataJSON() as { url: string }).url);
      const held = this.#podcastReadsHeld;
      if (held !== null) {
        await new Promise<void>((answer) => held.push(answer));
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(this.#podcastAnswer) });
    });

    await this.#page.route("**/api/podcasts/transcript", (route) => {
      this.#podcastTranscriptAsks.push(route.request().postDataJSON() as { feedUrl: string; guid: string });
      const details = { failure: "no-captions", ...(this.#podcastTranscribable ? { transcribable: true } : {}) };
      return this.#podcastWords === null
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "transcript_unavailable", message: "Simulated: no transcript", details } }),
          })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(this.#podcastWords) });
    });

    await this.#page.route("**/api/podcasts/transcript/check", (route) => {
      const check: TranscriptCheck = this.#podcastCheck ?? (this.#podcastWords === null ? { words: "unknown" } : { words: "found" });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(check) });
    });

    await this.#page.route(/\/api\/(podcasts|tiktok)\/transcription/, (route) => {
      if (route.request().method() === "POST") {
        const asked = route.request().postDataJSON() as { feedUrl: string; guid: string } | { url: string };
        if ("url" in asked) {
          this.#tiktokTranscriptionAsks.push(asked.url);
        } else {
          this.#transcriptionAsks.push(asked);
        }
      }
      const next = this.#transcriptionScript.length > 1 ? this.#transcriptionScript.shift()! : this.#transcriptionScript[0];
      if (next === undefined) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "unavailable", message: "Simulated: no transcriber" } }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(next) });
    });

    await this.#page.route("**/api/generations", (route) =>
      route.request().method() === "GET"
        ? this.#respond(route, EndpointKey.OUR_KEY_STATUS, {
            onDefault: () => ({
              status: 200,
              body: this.#ourKeyAvailable ? { available: true, ...SIMULATED_OUR_MODEL } : { available: false },
            }),
            onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: not reachable" } } }),
          })
        : this.#respond(route, EndpointKey.OUR_KEY_GENERATE, {
            onDefault: () => {
              const request = route.request().postDataJSON() as OurKeyGenerationRequest;
              if (this.#ourKeyRefusal !== null) {
                const { status, code, details } = this.#ourKeyRefusal;
                return { status, body: { error: { code, message: `Simulated: ${code}`, details } } };
              }
              this.#ourKeyRequests.push(request);
              this.#trialTokensSent.push(route.request().headers()[TRIAL_TOKEN_HEADER] ?? null);
              const filedProjectIds = (request.input.existingProjects ?? [])
                .filter((project) => this.#ourKeyFilesInto.includes(project.name))
                .map((project) => project.id);
              return {
                status: 200,
                body: {
                  ...this.#ourKeyOverviewFor(request),
                  filedProjectIds,
                },
              };
            },
            onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: our key refused" } } }),
          }),
    );

    await this.#page.route("**/api/generations/profile", (route) =>
      this.#respond(route, EndpointKey.PROFILE_PASS, {
        onDefault: () => {
          this.#profilePasses.push(route.request().postDataJSON() as ProfilePassInput);
          return { status: 200, body: { items: this.#profilePassItems } };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: no pass" } } }),
      }),
    );

    await this.#page.route("**/api/generations/topics", (route) =>
      this.#respond(route, EndpointKey.TOPIC_MATCH, {
        onDefault: () => {
          const input = route.request().postDataJSON() as TopicMatchInput;
          this.#topicPasses.push(input);
          return { status: 200, body: { names: this.#topicMatches.filter((name) => input.topics.some((topic) => topic.name === name)) } };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: no pass" } } }),
      }),
    );

    await this.#page.route("**/api/generations/topic-suggestions", (route) =>
      this.#topicSuggestionsHeld
        ? undefined
        : this.#respond(route, EndpointKey.TOPIC_SUGGESTIONS, {
            onDefault: () => {
              this.#topicSuggestionsAsked.push({
                input: route.request().postDataJSON() as TopicSuggestionInput,
                trialToken: route.request().headers()[TRIAL_TOKEN_HEADER] ?? null,
              });
              return this.#topicSuggestion === null
                ? { status: 503, body: { error: { code: "unavailable", message: "Simulated: no suggestions" } } }
                : { status: 200, body: this.#topicSuggestion };
            },
            onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: no pass" } } }),
          }),
    );

    await this.#page.route("**/api/trials", (route) =>
      this.#respond(route, EndpointKey.TRIAL_START, {
        onDefault: () => {
          this.#trialTokensIssued += 1;
          return { status: 200, body: { token: `simulated-trial-${this.#trialTokensIssued}` } };
        },
        onError: () => ({ status: 503, body: { error: { code: "unavailable", message: "Simulated: no trials" } } }),
      }),
    );

    await this.#page.route("**/api/chats/*/messages", (route) =>
      this.#respond(route, EndpointKey.CHAT_MESSAGES, {
        onDefault: () => {
          const overviewId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2) ?? "");
          const body = route.request().postDataJSON() as Omit<ChatQuestionSent, "overviewId">;
          return this.#answerChat({ overviewId, ...body });
        },
        onError: () => ({ status: 502, body: { error: { code: "generation_failed", message: "Simulated: the provider failed" } } }),
      }),
    );

    // Registered after the overview route, so these win for the paths both would match.
    await this.#page.route(/\/api\/chats\/(library|projects\/[^/]+)\/messages$/, (route) =>
      this.#respond(route, EndpointKey.CHAT_MESSAGES, {
        onDefault: () => {
          const parts = new URL(route.request().url()).pathname.split("/");
          const owner: ChatOwner =
            parts.at(-2) === "library" ? { kind: "library" } : { kind: "project", id: decodeURIComponent(parts.at(-2) ?? "") };
          const body = route.request().postDataJSON() as Omit<ChatQuestionSent, "overviewId">;
          return this.#answerAsk(owner, body);
        },
        onError: () => ({ status: 502, body: { error: { code: "generation_failed", message: "Simulated: the provider failed" } } }),
      }),
    );

    await this.#page.route("**/api/chat-usage", (route) =>
      this.#respond(route, EndpointKey.CHAT_USAGE, {
        onDefault: () => ({ status: 200, body: this.#chatUsage }),
        onError: unauthenticated,
      }),
    );

    await this.#page.route("**/api/overview-usage", (route) =>
      this.#respond(route, EndpointKey.OVERVIEW_USAGE, {
        onDefault: () => ({ status: 200, body: usage() }),
        onError: unauthenticated,
      }),
    );

    await this.#page.route("**/api/overview-reservations", (route) =>
      this.#respond(route, EndpointKey.OVERVIEW_RESERVE, {
        onDefault: () => {
          if (this.#ownMonthSpent) {
            return {
              status: 429,
              body: {
                error: {
                  code: "too_many_requests",
                  message: "Simulated: this month's own-key overviews are made",
                  details: { quota: "own", resetsOn: "2026-11-01", retryAfterSeconds: 3600 },
                },
              },
            };
          }
          this.#reservations.push(route.request().postDataJSON());
          return { status: 200, body: usage() };
        },
        onError: unauthenticated,
      }),
    );

    await this.#page.route("**/api/overview-reservations/*", (route) =>
      this.#respond(route, EndpointKey.OVERVIEW_RELEASE, {
        onDefault: () => {
          this.#releases.push(decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? ""));
          return { status: 204, body: null };
        },
        onError: unauthenticated,
      }),
    );

    await this.#page.route("**/api/changes**", (route) =>
      this.#respond(route, EndpointKey.SYNC_CHANGES, {
        onDefault: () => {
          const params = new URL(route.request().url()).searchParams;
          const since = Number(params.get("since") ?? "0");
          const limit = Number(params.get("limit") ?? Infinity);
          const after = this.#feed.filter((change) => change.seq > since);
          const changes = after.slice(0, limit);
          return { status: 200, body: { changes, next: changes.at(-1)?.seq ?? since, more: after.length > changes.length } };
        },
        onError: unauthenticated,
      }),
    );
  };

  #handleSampleNetworking = async (): Promise<void> => {
    const unavailable = () => ({
      status: 503,
      body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
    });
    await this.#page.route("**/api/samples", (route) =>
      this.#respond(route, EndpointKey.SAMPLES, {
        onDefault: () => ({
          status: 200,
          body: { samples: this.#startSamples.map((token) => ({ token, note: this.#shareSnapshots.get(token)!.note })) },
        }),
        onError: unavailable,
      }),
    );
    await this.#page.route("**/api/samples/*", (route) =>
      this.#respond(route, EndpointKey.SAMPLE, {
        onDefault: () => {
          const token = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
          const snapshot = this.#startSamples.some((sample) => sample === token) ? this.#shareSnapshots.get(token) : undefined;
          return snapshot === undefined
            ? { status: 404, body: { error: { code: "not_found", message: "Simulated: no such sample" } } }
            : { status: 200, body: snapshot };
        },
        onError: unavailable,
      }),
    );
  };

  // A link keeps its token, share date and views when its copy is replaced.
  #putShare = ({ overview, transcript, narration }: ShareRequest): { status: number; body: unknown } => {
    const existing = [...this.#shares.values()].find((share) => share.overviewId === overview.id);
    const token = existing?.token ?? `iwftShareToken${this.#nextShareToken++}`.slice(0, 16).padEnd(16, "0");
    // The whole copy is kept so a test can tell a share carrying its transcript from one without.
    const snapshot = shareSnapshot({ overview, narration: narration ?? null });
    const { note } = snapshot;
    const share: Share = {
      token: ShareToken.parse(token),
      url: `https://overview.test/s/${token}`,
      overviewId: overview.id,
      title: overview.source.title,
      sharedAt: existing?.sharedAt ?? "2026-09-30T11:00:00.000Z",
      updatedAt: "2026-09-30T11:00:00.000Z",
      views: existing?.views ?? 0,
      contentHash: createHash("sha256").update(shareContentSource(note)).digest("hex"),
      hasNarration: snapshot.narration !== null,
    };
    this.#shares.set(token, share);
    this.#shareSnapshots.set(token, snapshot);
    return { status: existing === undefined ? 201 : 200, body: share };
  };

  #handleConnectionNetworking = async (): Promise<void> => {
    const notFound = () => ({
      status: 404,
      body: { error: { code: "not_found", message: "Simulated: this request has expired or was already answered" } },
    });
    const requestIdOf = (route: Route) => new URL(route.request().url()).pathname.split("/")[4] ?? "";
    const pending = (requestId: string) =>
      this.#connectionRequest !== null && this.#connectionRequest.id === requestId ? this.#connectionRequest : null;

    await this.#page.route("**/api/oauth/requests/*", (route) => {
      const found = pending(requestIdOf(route));
      return this.#respond(route, EndpointKey.CONNECTION_REQUEST, {
        onDefault: () => (found === null ? notFound() : { status: 200, body: found }),
        onError: notFound,
      });
    });

    await this.#page.route("**/api/oauth/requests/*/decision", (route) => {
      const requestId = requestIdOf(route);
      const { approve } = route.request().postDataJSON() as { approve: boolean };
      return this.#respond(route, EndpointKey.CONNECTION_DECISION, {
        onDefault: () => {
          if (this.#sessionLapsed) {
            return { status: 401, body: { error: { code: "unauthenticated", message: "Simulated: no such session" } } };
          }
          if (pending(requestId) === null) {
            return notFound();
          }
          this.#decisions.push({ requestId, approve });
          this.#connectionRequest = null;
          const answer = approve ? "code=simulated-code" : "error=access_denied";
          return { status: 200, body: { redirectTo: `${SIMULATED_ASSISTANT_CALLBACK}?${answer}&state=s` } };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      });
    });

    await this.#page.route("**/api/connections", (route) =>
      this.#respond(route, EndpointKey.CONNECTIONS_LIST, {
        onDefault: () => ({ status: 200, body: { connections: this.#connections } }),
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );

    await this.#page.route("**/api/connections/*", (route) => {
      const connectionId = new URL(route.request().url()).pathname.split("/")[3] ?? "";
      return this.#respond(route, EndpointKey.CONNECTION_REVOKE, {
        onDefault: () => {
          this.#connections = this.#connections.filter((connection) => connection.id !== connectionId);
          this.#revoked.push(connectionId);
          return { status: 204, body: undefined };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      });
    });

    await this.#page.route(`${SIMULATED_ASSISTANT_CALLBACK}**`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>Back at the assistant</title>" }),
    );
  };

  #handleAnalyticsNetworking = async (): Promise<void> => {
    await this.#page.route("**/api/events", (route) =>
      this.#respond(route, EndpointKey.EVENTS, {
        onDefault: () => {
          this.#eventBatches.push(route.request().postDataJSON() as AnalyticsEventBatch);
          return { status: 204, body: undefined };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );
    await this.#page.route("**/api/events/declined", (route) =>
      this.#respond(route, EndpointKey.EVENTS_DECLINED, {
        onDefault: () => {
          this.#declines.push(route.request().postDataJSON() as AnalyticsDeclined);
          return { status: 204, body: undefined };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );
    await this.#page.route("**/api/shares/*/events", (route) =>
      this.#respond(route, EndpointKey.SHARED_PAGE_EVENTS, {
        onDefault: () => {
          const token = new URL(route.request().url()).pathname.split("/").at(-2)!;
          this.#sharedPageEventBatches.push({ token, batch: route.request().postDataJSON() as SharedPageEventBatch });
          return { status: 204, body: undefined };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );
    await this.#page.route("**/api/errors", (route) =>
      this.#respond(route, EndpointKey.ERRORS, {
        onDefault: () => {
          this.#errorBatches.push(route.request().postDataJSON() as ClientErrorBatch);
          return { status: 204, body: undefined };
        },
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
        }),
      }),
    );
  };

  #respond = async (
    route: Route,
    endpoint: EndpointKey,
    handlers: {
      onDefault: () => SimulatedResponse;
      onError: () => SimulatedResponse;
    },
  ): Promise<void> => {
    this.#callCounts.set(endpoint, this.getCallCount(endpoint) + 1);
    const behaviour = this.#behaviours.get(endpoint) ?? EndpointBehaviour.DEFAULT;

    if (behaviour === EndpointBehaviour.STALL) {
      // Held, not fulfilled or aborted: the request hangs until releaseEndpoint() lets it go.
      this.#stalled.push({ endpoint, route, onDefault: handlers.onDefault });
      return;
    }

    await fulfil(route, behaviour === EndpointBehaviour.ERROR ? handlers.onError() : handlers.onDefault());
  };

  // Seeding queues data for the next mount; inspection reads the live browser-side store.
  overviews = {
    seed: (overview: Overview): void => {
      this.#seedOverviews.push(overview);
    },
    // Chat asks only about overviews the server holds too.
    seedSynced: (overview: Overview): void => {
      this.#seedOverviews.push(overview);
      this.#feed.push({
        kind: "overview",
        id: overview.id,
        schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
        rev: 1,
        seq: this.#nextSeq(),
        updatedAt: new Date().toISOString(),
        deleted: false,
        body: overview,
      });
    },
    seedState: (state: OverviewState): void => {
      this.#seedStates.push(state);
    },
    seedTopic: (topic: Topic): void => {
      this.#seedTopics.push(topic);
    },
    seedUnreadable: (record: UnreadableRecord): void => {
      this.#seedUnreadable.push(record);
    },
    get: (id: OverviewId) => this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.getOverview(overviewId), id),
    getState: (id: OverviewId) => this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.getOverviewState(overviewId), id),
    failStateWritesFor: (id: OverviewId) =>
      this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.failStateWritesFor(overviewId), id),
  };

  chats = {
    answerWith: (reply: ChatAnswerReply): void => {
      this.#chatReplies.push({ kind: "answer", ...reply });
    },
    failWith: (): void => {
      this.#chatReplies.push({ kind: "failed" });
    },
    refuseWith: (status: number, error: { code: string; message?: string; details?: Record<string, unknown> }): void => {
      this.#chatReplies.push({ kind: "refused", status, error });
    },
    seed: (chat: Chat): void => {
      this.#chatRecords.set(chat.id, { ...chat, rev: 1 });
      this.#feed.push(chatChange(chat, 1, this.#nextSeq()));
    },
    setUsage: (usage: Partial<ChatUsage>): void => {
      this.#chatUsage = { ...this.#chatUsage, ...usage };
    },
    questions: () => this.#chatQuestions,
    list: (overviewId: OverviewId) =>
      this.#page.evaluate((id) => window.__iwftStores__.chatStore.listChats({ kind: "overview", id }), overviewId),
    listLibrary: () => this.#page.evaluate(() => window.__iwftStores__.chatStore.listChats({ kind: "library" })),
  };

  #nextSeq = (): number => Math.max(0, ...this.#feed.map((change) => change.seq)) + 1;

  #answerChat = (request: ChatQuestionSent): SimulatedResponse => {
    this.#chatQuestions.push(request);
    const reply = this.#chatReplies.shift() ?? DEFAULT_CHAT_REPLY;
    if (reply.kind === "refused") {
      return { status: reply.status, body: { error: { message: "Simulated", ...reply.error } } };
    }
    if (reply.kind === "failed") {
      return { status: 200, stream: [{ type: "failed", message: "Simulated: the provider failed" }] };
    }
    const at = new Date().toISOString();
    const chatId = chatRecordId(request.overviewId, request.conversationId);
    const known = this.#chatRecords.get(chatId);
    // Server labelling: S1 up, never repeated; pinned overviews by title, pinned projects not expanded.
    const before = (known?.messages ?? []).flatMap((message) => (message.from === "reader" ? (message.sources ?? []) : []));
    const library = new Map(this.#seedOverviews.map((overview) => [overview.id as string, overview.source.title]));
    const sources: ChatSource[] = [];
    const add = (overviewId: string, title: string, how: ChatSource["how"]) => {
      if (overviewId === request.overviewId || [...before, ...sources].some((source) => source.overviewId === overviewId)) {
        return;
      }
      sources.push({ label: `S${before.length + sources.length + 1}`, overviewId: overviewId as OverviewId, title, how });
    };
    for (const id of request.pins?.overviews ?? []) {
      add(id, library.get(id) ?? "Untitled", "pinned");
    }
    if (request.searchLibrary !== false) {
      for (const found of reply.found ?? []) {
        add(found.overviewId, found.title, "found");
      }
    }
    const setAside = before.filter((source) => request.setAside?.includes(source.overviewId)).map((source) => source.label);
    const messages: ChatMessage[] = [
      {
        from: "reader",
        text: request.text,
        at,
        ...(sources.length > 0 ? { sources } : {}),
        ...(setAside.length > 0 ? { setAside } : {}),
        ...(request.searchLibrary === false ? { searchedLibrary: false as const } : {}),
      },
      {
        from: "answer",
        text: reply.text,
        at,
        citations: reply.citations ?? [],
        inSource: reply.inSource ?? true,
        ...(reply.sections === undefined ? {} : { sections: reply.sections }),
      },
    ];
    const record =
      known === undefined
        ? { id: chatId, overviewId: request.overviewId as OverviewId, startedAt: at, messages, rev: 1 }
        : { ...known, messages: [...known.messages, ...messages], rev: known.rev + 1 };
    this.#chatRecords.set(chatId, record);
    this.#feed.push(chatChange(record, record.rev, this.#nextSeq()));
    this.#chatUsage = { ...this.#chatUsage, used: this.#chatUsage.used + 1 };
    const streamed = reply.sections?.intro ?? reply.text;
    const pieces = streamed.match(/\S+\s*/g) ?? [streamed];
    const pinned = sources.filter((source) => source.how === "pinned");
    const found = sources.filter((source) => source.how === "found");
    return {
      status: 200,
      stream: [
        ...(sources.length > 0 ? [{ type: "sources", pinned, found }] : []),
        ...pieces.map((text) => ({ type: "text", text })),
        ...(reply.sections?.sections ?? []).map((section) => ({ type: "section", section })),
        { type: "answered", chatId, rev: record.rev, messages },
      ],
    };
  };

  #answerAsk = (owner: ChatOwner, request: Omit<ChatQuestionSent, "overviewId">): SimulatedResponse => {
    this.#chatQuestions.push({ overviewId: owner.kind === "library" ? "library" : `project:${owner.id}`, ...request });
    const reply = this.#chatReplies.shift() ?? DEFAULT_CHAT_REPLY;
    if (reply.kind === "refused") {
      return { status: reply.status, body: { error: { message: "Simulated", ...reply.error } } };
    }
    if (reply.kind === "failed") {
      return { status: 200, stream: [{ type: "failed", message: "Simulated: the provider failed" }] };
    }
    const at = new Date().toISOString();
    const chatId = chatRecordId(owner, request.conversationId);
    const known = this.#chatRecords.get(chatId);
    const before = (known?.messages ?? []).flatMap((message) => (message.from === "reader" ? (message.sources ?? []) : []));
    const library = new Map(this.#seedOverviews.map((overview) => [overview.id as string, overview.source.title]));
    const pinned: ChatSource[] = [];
    for (const id of request.pins?.overviews ?? []) {
      if (![...before, ...pinned].some((source) => source.overviewId === id)) {
        pinned.push({
          label: `S${before.length + pinned.length + 1}`,
          overviewId: id as OverviewId,
          title: library.get(id) ?? "Untitled",
          how: "pinned",
        });
      }
    }
    const picked = reply.picked ?? [];
    const messages: ChatMessage[] = [
      {
        from: "reader",
        text: request.text,
        at,
        ...(pinned.length > 0 ? { sources: pinned } : {}),
        ...(picked.length > 0 ? { picked: picked.map((each) => each.overviewId) } : {}),
      },
      {
        from: "answer",
        text: reply.text,
        at,
        citations: reply.citations ?? [],
        inSource: reply.inSource ?? true,
        ...(reply.sections === undefined ? {} : { sections: reply.sections }),
        ...(reply.stats === undefined ? {} : { stats: reply.stats }),
      },
    ];
    const record =
      known === undefined
        ? { id: chatId, ...(owner.kind === "project" ? { projectId: owner.id as ProjectId } : {}), startedAt: at, messages, rev: 1 }
        : { ...known, messages: [...known.messages, ...messages], rev: known.rev + 1 };
    this.#chatRecords.set(chatId, record);
    this.#feed.push(chatChange(record, record.rev, this.#nextSeq()));
    this.#chatUsage = { ...this.#chatUsage, used: this.#chatUsage.used + 1 };
    const streamed = reply.sections?.intro ?? reply.text;
    const pieces = streamed.match(/\S+\s*/g) ?? [streamed];
    return {
      status: 200,
      stream: [
        ...(picked.length > 0
          ? [
              { type: "picking" },
              { type: "picked", overviews: picked, ...(reply.stats?.looked === undefined ? {} : { looked: reply.stats.looked }) },
            ]
          : []),
        ...(pinned.length > 0 ? [{ type: "sources", pinned, found: [] }] : []),
        ...pieces.map((text) => ({ type: "text", text })),
        ...(reply.sections?.sections ?? []).map((section) => ({ type: "section", section })),
        { type: "answered", chatId, rev: record.rev, messages },
      ],
    };
  };

  sync = {
    seedChange: (change: RecordChange): void => {
      this.#feed.push(change);
    },
    seedTranscript: (transcript: StoredTranscript): void => {
      this.#accountTranscripts.set(transcript.videoId, transcript);
    },
    setMinSupportedClientVersion: (version: number): void => {
      this.#minSupportedClientVersion = version;
    },
    cursor: () => this.#page.evaluate(() => window.__iwftStores__.syncStorage?.cursor() ?? null),
    queueLocalWrites: (entries: OutboxEntry[]) =>
      this.#page.evaluate((queued) => {
        for (const entry of queued) {
          window.__iwftStores__.syncStorage?.seedPending(entry);
        }
      }, entries),
    overviewsHeldIn: (accountId: string | null) =>
      this.#page.evaluate(async (id) => (await window.__iwftLibraries__.get(id)?.overviewStore.listOverviews())?.length ?? 0, accountId),
    enrolled: (accountId: string | null) =>
      this.#page.evaluate((id) => window.__iwftLibraries__.get(id)?.syncStorage?.enrolled ?? false, accountId),
    simulateBackOnline: () => this.#page.evaluate(() => window.dispatchEvent(new Event("online"))),
  };

  shares = {
    live: (): Share[] => [...this.#shares.values()],
    snapshot: (token: string): SharedOverview | null => this.#shareSnapshots.get(token) ?? null,
    simulateCopyIsStale: (): void => {
      for (const [token, share] of this.#shares) {
        this.#shares.set(token, { ...share, contentHash: "stale".padEnd(64, "0") });
      }
    },
  };

  startSamples = {
    offer: (...overviews: Overview[]): ShareToken[] => {
      this.#startSamples = overviews.map((overview, index) => {
        const token = ShareToken.parse(`iwftSample${index}`.padEnd(16, "0"));
        this.#shareSnapshots.set(token, shareSnapshot({ overview, narration: null }));
        return token;
      });
      return [...this.#startSamples];
    },
  };

  auth = {
    magicLinkRequests: (): MagicLinkRequest[] => [...this.#magicLinkRequests],
    signInAttempts: (): string[] => [...this.#signInAttempts],
    emailCodeAttempts: (): { email: string; code: string }[] => [...this.#emailCodeAttempts],
    linkCodeServers: (): string[] => [...this.#linkCodeServers],
    linkWasAskedForFrom: (surface: AuthSurface): void => {
      this.#linkSurface = surface;
    },
    accountIsNamed: (firstName: string): void => {
      this.#accountFirstName = firstName;
    },
    accountEmailIs: (email: string): void => {
      this.#accountEmail = email;
    },
    sessionIsFresh: (): void => {
      this.#verificationRequired = false;
    },
    newAddressIsTaken: (): void => {
      this.#newAddressTaken = true;
    },
    revertIsRefused: (refusal: { reason: "expired" | "spent" | "taken"; email?: string }): void => {
      this.#revertRefusal = refusal;
    },
    namesSaved: (): Array<string | null> => [...this.#namesSaved],
    verificationAsks: (): number => this.#verificationAsks,
    verificationPurposes: (): string[] => [...this.#verificationPurposes],
    verificationCodes: (): string[] => [...this.#verificationCodes],
    accountDeletions: (): number => this.#accountDeletions,
    deleteNeedsVerification: (): void => {
      this.#deleteNeedsVerification = true;
    },
    emailChangeAsks: (): string[] => [...this.#emailChangeAsks],
    emailChangeCodes: (): string[] => [...this.#emailChangeCodes],
    revertTokens: (): string[] => [...this.#revertTokens],
    sessionHasLapsed: (): void => {
      this.#sessionLapsed = true;
    },
    accountIsOn: (plan: Plan): void => {
      this.#accountPlan = plan;
    },
    sessionHasEnded: (): void => {
      this.#sessionHasEnded = true;
      this.simulateEndpointError(EndpointKey.SESSION_LINK_CODE);
    },
  };

  videos = {
    answerWith: (read: VideoRead): void => {
      this.#videoAnswer = read;
    },
    reads: (): string[] => [...this.#videoReads],
  };

  articles = {
    answerWith: (read: ArticleRead): void => {
      this.#articleAnswer = read;
    },
    reads: (): string[] => [...this.#articleReads],
    trialTokensSent: (): Array<string | null> => [...this.#articleReadTrialTokens],
    trialReadsSpent: (quota: "trial-reads" | "trial-reads-address"): void => {
      this.#articleReadsSpent = quota;
    },
  };

  tiktok = {
    answerWith: (read: TikTokRead): void => {
      this.#tiktokAnswer = read;
    },
    reads: (): string[] => [...this.#tiktokReads],
    // The states come from `podcasts.transcribesAs`, which both share, as the server's queue is shared.
    transcriptionAsks: (): string[] => [...this.#tiktokTranscriptionAsks],
  };

  podcasts = {
    answerWith: (read: PodcastRead): void => {
      this.#podcastAnswer = read;
    },
    wordsAre: (transcript: StoredTranscript): void => {
      this.#podcastWords = transcript;
    },
    holdReads: (): void => {
      this.#podcastReadsHeld = [];
    },
    letReadsGo: (): void => {
      const held = this.#podcastReadsHeld ?? [];
      this.#podcastReadsHeld = null;
      for (const answer of held) {
        answer();
      }
    },
    reads: (): string[] => [...this.#podcastReads],
    transcriptAsks: (): Array<{ feedUrl: string; guid: string }> => [...this.#podcastTranscriptAsks],
    checkSays: (check: TranscriptCheck): void => {
      this.#podcastCheck = check;
    },
    offersTranscribing: (): void => {
      this.#podcastTranscribable = true;
    },
    transcribesAs: (...states: PodcastTranscription[]): void => {
      this.#transcriptionScript = states;
    },
    transcriptionAsks: (): Array<{ feedUrl: string; guid: string }> => [...this.#transcriptionAsks],
    transcribingUsed: (usage: TranscriptionUsage): void => {
      this.#transcriptionUsage = usage;
    },
  };

  ourKey = {
    isAvailable: (): void => {
      this.#ourKeyAvailable = true;
    },
    refuses: (status: number, code: string, details: Record<string, unknown>): void => {
      this.#ourKeyRefusal = { status, code, details };
    },
    refusesNoMore: (): void => {
      this.#ourKeyRefusal = null;
    },
    ownMonthIsSpent: (): void => {
      this.#ownMonthSpent = true;
    },
    monthHasMade: (made: { ours?: number; own?: number }): void => {
      this.#madeEarlierThisMonth = { ours: made.ours ?? 0, own: made.own ?? 0 };
    },
    anthropicIsOutOfCredit: (): void => {
      this.#anthropicOutOfCredit = true;
    },
    // As a smaller model's structured-output limits turn down the overview's schema (OV-247).
    anthropicRefusesTheModel: (): void => {
      this.#anthropicRefusesModel = true;
    },
    generations: (): OurKeyGenerationRequest[] => [...this.#ourKeyRequests],
    writesHowToApply: (items: string[]): void => {
      this.#ourKeyHowToApply = items;
    },
    filesInto: (projectNames: string[]): void => {
      this.#ourKeyFilesInto = projectNames;
    },
    profilePassFinds: (items: ProfilePassItem[]): void => {
      this.#profilePassItems = items;
    },
    profilePasses: (): ProfilePassInput[] => [...this.#profilePasses],
    sortsSampleInto: (names: string[]): void => {
      this.#topicMatches = names;
    },
    topicPasses: (): TopicMatchInput[] => [...this.#topicPasses],
    // Left unset, the suggestion pass fails.
    suggestsTopics: (result: TopicSuggestionResult): void => {
      this.#topicSuggestion = result;
    },
    topicSuggestionsAsked: () => [...this.#topicSuggestionsAsked],
    holdsTopicSuggestions: (): void => {
      this.#topicSuggestionsHeld = true;
    },
    trialTokensSent: (): Array<string | null> => [...this.#trialTokensSent],
    trialTokensIssued: (): number => this.#trialTokensIssued,
    reservations: (): Array<{ overviewId: string; shareToken?: string }> => [...this.#reservations],
    releases: (): string[] => [...this.#releases],
  };

  narration = {
    seedReady: (overview: Overview, voice: NarrationVoice = DEFAULT_NARRATION_VOICE, secondsPerLine = SIMULATED_SECONDS_PER_LINE): void => {
      const lines = spokenScript(overview);
      const key = keyFor(lines, voice);
      this.#renders.set(key, { render: readyRender(key, lines.length, secondsPerLine), lineCount: lines.length });
    },
    isStored: (overview: Overview, voice: NarrationVoice): boolean =>
      this.#renders.get(keyFor(spokenScript(overview), voice))?.render.status === "ready",
    seedSamples: (): void => {
      this.#samples = NarrationVoice.options.map((voice) => {
        const lines = ["Hello.", `A sample in ${voice}.`];
        const key = keyFor(lines, voice);
        this.#renders.set(key, {
          render: readyRender(key, lines.length, SAMPLE_SECONDS / lines.length),
          lineCount: lines.length,
        });
        return { voice, key };
      });
    },
    requestedVoices: (): string[] => [...this.#narrationVoices],
    finishRenders: (): void => {
      for (const [key, held] of this.#renders) {
        if (held.render.status !== "ready") {
          held.render = readyRender(key, held.lineCount);
        }
      }
    },
    failRenders: (): void => {
      for (const [key, held] of this.#renders) {
        if (held.render.status !== "ready") {
          held.render = { key, status: "failed" };
        }
      }
    },
    accountIsBusy: (): void => {
      this.#narrationBusy = true;
    },
    dailyCapIsSpent: (): void => {
      this.#narrationDailyCapSpent = true;
    },
    requestCount: (): number => this.#narrationPriorities.length,
    requestedPriorities: (): string[] => [...this.#narrationPriorities],
  };

  connections = {
    seedRequest: (request: ConnectionRequest): void => {
      this.#connectionRequest = request;
    },
    decisions: (): Array<{ requestId: string; approve: boolean }> => [...this.#decisions],
    seed: (connection: Connection): void => {
      this.#connections.push(connection);
    },
    revoked: (): string[] => [...this.#revoked],
  };

  analytics = {
    batches: (): AnalyticsEventBatch[] => [...this.#eventBatches],
    events: (): Array<{ name: string; props: Record<string, unknown> }> =>
      this.#eventBatches.flatMap(({ events }) => events.map(({ name, props }) => ({ name, props }))),
    eventNames: (): string[] => this.#eventBatches.flatMap(({ events }) => events.map(({ name }) => name)),
    declines: (): AnalyticsDeclined[] => [...this.#declines],
    sharedPage: {
      batches: (): Array<{ token: string; batch: SharedPageEventBatch }> => [...this.#sharedPageEventBatches],
      events: (): Array<{ name: string; props: Record<string, unknown> }> =>
        this.#sharedPageEventBatches.flatMap(({ batch }) => batch.events.map(({ name, props }) => ({ name, props }))),
    },
  };

  errors = {
    batches: (): ClientErrorBatch[] => [...this.#errorBatches],
    reported: (): ClientErrorBatch["errors"] => this.#errorBatches.flatMap(({ errors }) => errors),
    timings: (): NonNullable<ClientErrorBatch["timings"]> => this.#errorBatches.flatMap(({ timings }) => timings ?? []),
  };

  transcripts = {
    seed: (transcript: StoredTranscript): void => {
      this.#seedTranscripts.push(transcript);
    },
    seedService: (transcript: StoredTranscript): void => {
      this.#serviceTranscripts ??= new Map();
      this.#serviceTranscripts.set(transcript.videoId, transcript);
    },
    serviceIsOff: (): void => {
      this.#serviceTranscripts = null;
    },
    serviceCapReached: (resetsInSeconds: number): void => {
      this.#serviceRefusal = { daily: true, retryAfterSeconds: resetsInSeconds };
    },
    serviceBusy: (retryAfterSeconds: number): void => {
      this.#serviceRefusal = { daily: false, retryAfterSeconds };
    },
    serviceAnswersAgain: (): void => {
      this.#serviceRefusal = null;
    },
  };

  meaning = {
    seed: (query: string, overviewIds: string[]): void => {
      this.#meaningMatches.set(query, overviewIds);
    },
  };

  transcriptSearch = {
    seed: (query: string, matches: TranscriptSearchResponse["matches"]): void => {
      this.#transcriptMatches.set(query, matches);
    },
  };

  playlists = {
    seed: (lookup: PlaylistLookup): void => {
      this.#playlists.set(lookup.id, lookup);
    },
    seedPrivate: (playlistId: string): void => {
      this.#playlists.set(playlistId, "private");
    },
    seedFollowed: (playlist: FollowedPlaylist): void => {
      this.#seedFollowed.push(playlist);
    },
    seedCheck: (check: PlaylistCheck): void => {
      this.#seedChecks.push(check);
    },
    seedQueued: (capture: QueuedCapture): void => {
      this.#seedQueue.push(capture);
    },
    listFollowed: () => this.#page.evaluate(() => window.__iwftStores__.followedPlaylistStore.listFollowed()),
    listQueue: () => this.#page.evaluate(() => window.__iwftStores__.captureQueueStore.listQueue()),
  };

  transcriptStore = {
    getTranscript: (videoId: VideoId) => this.#page.evaluate((id) => window.__iwftStores__.transcriptStore.getTranscript(id), videoId),
  };

  settingsStore = {
    get: () => this.#page.evaluate(() => window.__iwftStores__.settingsStore.get()),
  };

  projects = {
    seed: (project: Project): void => {
      this.#seedProjects.push(project);
    },
    seedMember: (member: ProjectMember): void => {
      this.#seedProjectMembers.push(member);
    },
    list: () => this.#page.evaluate(() => window.__iwftStores__.projectStore.listProjects()),
    members: () => this.#page.evaluate(() => window.__iwftStores__.projectStore.listMembers()),
  };

  overviewStore = {
    listOverviews: () => this.#page.evaluate(() => window.__iwftStores__.overviewStore.listOverviews()),
    listTopics: () => this.#page.evaluate(() => window.__iwftStores__.overviewStore.listTopics()),
    getOverviewState: (id: OverviewId) =>
      this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.getOverviewState(overviewId), id),
  };
}
