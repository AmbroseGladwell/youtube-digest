import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import {
  CLIENT_VERSION,
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
  type AuthSurface,
  type Connection,
  type ConnectionRequest,
  type Plan,
  canConnectAssistant,
  type MagicLinkRequest,
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
  type UnreadableRecord,
  type VideoId,
} from "@overview/domain";
import { EndpointBehaviour, EndpointKey } from "./EndpointKey.testHelper.js";
import type { IwftHooksConfig } from "./IwftHooksConfig.testHelper.js";
import {
  makeAnthropicMessageResponse,
  makeGeneratedOutputFixture,
} from "./fixtures/anthropicFixtures.js";
import {
  IWFT_VIDEO_ID,
  makeJson3Fixture,
  makeMicroformatFixture,
  makePlayerResponseFixture,
  makeServiceTranscriptFixture,
} from "./fixtures/innerTubeFixtures.js";
import type {} from "./iwftWindow.testHelper.js";

// What the simulated server hands a signed-in reader (docs/features/sign-in.md).
export const SIMULATED_ACCOUNT_ID = "account";
export const SIMULATED_EMAIL = "reader@example.com";
export const SIMULATED_LINK_CODE = "ABCD-EFGH";
export const SIMULATED_BEARER = "linked-session-token";

// Where a simulated assistant is sent back to once the reader has answered.
export const SIMULATED_ASSISTANT_CALLBACK = "https://assistant.test/callback";

// Every line of simulated narration lasts this long, so a test can say where a line starts.
export const SIMULATED_SECONDS_PER_LINE = 2;

// Long enough that a test can see a sample playing before it ends.
const SAMPLE_SECONDS = 20;

const keyFor = (lines: string[], voice: string) =>
  createHash("sha256").update(narrationKeySource(lines, voice)).digest("hex");

const readyRender = (key: string, lineCount: number, secondsPerLine = SIMULATED_SECONDS_PER_LINE): NarrationRender => ({
  key,
  status: "ready",
  lineStartsSeconds: Array.from({ length: lineCount }, (_, index) => index * secondsPerLine),
  durationSeconds: lineCount * secondsPerLine,
  fileUrl: `/api/audio/${key}/file`,
});

// Headless Chromium cannot decode the M4A the real service makes, so the simulated file is
// silence as 8-bit WAV, the length the render says it is.
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

export class BackendSimulator {
  #page: Page;
  #seedOverviews: Overview[] = [];
  #seedStates: OverviewState[] = [];
  #seedTopics: Topic[] = [];
  #seedTranscripts: StoredTranscript[] = [];
  #seedUnreadable: UnreadableRecord[] = [];

  #behaviours = new Map<EndpointKey, EndpointBehaviour>(
    Object.values(EndpointKey).map((key) => [key, EndpointBehaviour.DEFAULT]),
  );
  #callCounts = new Map<EndpointKey, number>();
  #shares = new Map<string, Share>();
  #shareSnapshots = new Map<string, SharedOverview>();
  #nextShareToken = 0;
  #stalled: Array<{
    endpoint: EndpointKey;
    route: Route;
    onDefault: () => { status: number; body: unknown };
  }> = [];
  #generatedOutputOverrides: Record<string, unknown> = {};
  #feed: RecordChange[] = [];
  #accountTranscripts = new Map<string, StoredTranscript>();
  #sharedTranscripts = new Map<string, StoredTranscript>();
  // On, as it is in production, answering for the fixture video; null is the service off.
  #serviceTranscripts: Map<string, StoredTranscript> | null = new Map([[IWFT_VIDEO_ID, makeServiceTranscriptFixture()]]);
  #minSupportedClientVersion = 1;
  #magicLinkRequests: MagicLinkRequest[] = [];
  #signInAttempts: string[] = [];
  #emailCodeAttempts: { email: string; code: string }[] = [];
  #linkCodeServers: string[] = [];
  #linkSurface: AuthSurface = "web";
  #accountFirstName: string | null = null;
  #sessionHasEnded = false;
  #accountPlan: Plan = "free";
  #sessionLapsed = false;
  #connectionRequest: ConnectionRequest | null = null;
  #decisions: Array<{ requestId: string; approve: boolean }> = [];
  #connections: Connection[] = [];
  #revoked: string[] = [];
  #renders = new Map<string, { render: NarrationRender; lineCount: number }>();
  #narrationBusy = false;
  #narrationPriorities: string[] = [];
  #narrationVoices: string[] = [];
  #samples: Array<{ voice: string; key: string }> = [];
  #eventBatches: AnalyticsEventBatch[] = [];
  #declines: AnalyticsDeclined[] = [];
  #sharedPageEventBatches: Array<{ token: string; batch: SharedPageEventBatch }> = [];
  #errorBatches: ClientErrorBatch[] = [];

  constructor(page: Page) {
    this.#page = page;
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

  // Lets a test hold a request open, act on the loading state it produces, and then let it
  // through — which is the only way to drive a multi-step pipeline one step at a time
  // without racing it (frontend-testing-guide.md 4.4).
  releaseEndpoint = async (endpoint: EndpointKey): Promise<void> => {
    const held = this.#stalled.filter((entry) => entry.endpoint === endpoint);
    this.#stalled = this.#stalled.filter((entry) => entry.endpoint !== endpoint);
    this.simulateEndpointDefault(endpoint);
    for (const { route, onDefault } of held) {
      const { status, body } = onDefault();
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    }
  };

  setGeneratedOutputOverrides = (overrides: Record<string, unknown>): void => {
    this.#generatedOutputOverrides = overrides;
  };

  // Read by Launcher at mount time and passed as Playwright CT's hooksConfig — the only
  // channel that can carry this seed data into the browser-side stores (see
  // IwftHooksConfig.testHelper.ts). apiKeys is merged in by the Launcher itself.
  buildHooksConfig = (): Omit<IwftHooksConfig, "apiKeys"> => ({
    seedOverviews: this.#seedOverviews,
    seedStates: this.#seedStates,
    seedUnreadable: this.#seedUnreadable,
    seedTopics: this.#seedTopics,
    seedTranscripts: this.#seedTranscripts,
  });

  handleNetworking = async (): Promise<void> => {
    await this.#handleSyncNetworking();
    // The WEB client is asked only for a publish date and carries no caption tracks, so it
    // is not the call worth counting (docs/features/transcript-retrieval.md).
    await this.#page.route("**/www.youtube.com/youtubei/v1/player**", (route) => {
      const isMetadataClient =
        route.request().headers()["x-youtube-client-name"]?.toUpperCase() === "WEB";
      if (isMetadataClient) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(makeMicroformatFixture()),
        });
      }
      return this.#respond(route, EndpointKey.INNERTUBE_PLAYER, {
        onDefault: () => ({ status: 200, body: makePlayerResponseFixture() }),
        // A source failure rather than a dead video: ERROR would be a fact about the
        // video and would stop the ladder instead of falling to the next rung.
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

    await this.#page.route("**/api.anthropic.com/v1/messages**", (route) =>
      this.#respond(route, EndpointKey.ANTHROPIC_MESSAGES, {
        onDefault: () => ({
          status: 200,
          body: makeAnthropicMessageResponse(
            makeGeneratedOutputFixture(this.#generatedOutputOverrides),
          ),
        }),
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

    await this.#page.route("**/api/session", (route) =>
      route.request().method() === "DELETE"
        ? this.#respond(route, EndpointKey.SESSION_DELETE, {
            onDefault: () => ({ status: 204, body: undefined }),
            onError: unauthenticated,
          })
        : this.#respond(route, EndpointKey.SESSION_READ, {
            onDefault: () =>
              this.#sessionLapsed
                ? unauthenticated()
                : {
                    status: 200,
                    body: {
                      accountId: SIMULATED_ACCOUNT_ID,
                      email: SIMULATED_EMAIL,
                      firstName: this.#accountFirstName,
                      expiresAt,
                      plan: this.#accountPlan,
                    },
                  },
            onError: () => ({
              status: 503,
              body: { error: { code: "unavailable", message: "Simulated: the database is not reachable" } },
            }),
          }),
    );

    await this.#handleConnectionNetworking();
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

    await this.#page.route("**/api/service-transcripts", (route) =>
      this.#respond(route, EndpointKey.SERVICE_TRANSCRIPT_STATUS, {
        onDefault: () => ({ status: 200, body: { available: this.#serviceTranscripts !== null } }),
        onError: () => ({
          status: 503,
          body: { error: { code: "unavailable", message: "Simulated: the server is not reachable" } },
        }),
      }),
    );

    // What our server fetched lands in the shared cache, so the next reader reads it there.
    await this.#page.route("**/api/service-transcripts/*", (route) =>
      this.#respond(route, EndpointKey.SERVICE_TRANSCRIPT, {
        onDefault: () => {
          if (this.#serviceTranscripts === null) {
            return { status: 503, body: { error: { code: "unavailable", message: "Simulated: the service is off" } } };
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
          this.#sharedTranscripts.set(videoId, fetched);
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
          if (held?.render.status === "ready") return { status: 200, body: held.render };
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
      // Byte ranges, as the real route answers them: a media element that cannot ask for a
      // range cannot seek.
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

    await this.#page.route("**/api/changes**", (route) =>
      this.#respond(route, EndpointKey.SYNC_CHANGES, {
        onDefault: () => {
          const since = Number(new URL(route.request().url()).searchParams.get("since") ?? "0");
          const changes = this.#feed.filter((change) => change.seq > since);
          return { status: 200, body: { changes, next: changes.at(-1)?.seq ?? since, more: false } };
        },
        onError: unauthenticated,
      }),
    );
  };

  // The server's own job, done here so an IWFT sees what a reader would: the copy is built
  // from the overview that was posted, and a link keeps its token, its share date and its
  // view count when the copy behind it is replaced (docs/features/sharing.md).
  #putShare = ({ overview, transcript, narration }: ShareRequest): { status: number; body: unknown } => {
    const existing = [...this.#shares.values()].find((share) => share.overviewId === overview.id);
    const token = existing?.token ?? `iwftShareToken${this.#nextShareToken++}`.slice(0, 16).padEnd(16, "0");
    // The whole copy is kept, not just the note: a simulator that dropped what was posted
    // could not tell a share that carries its transcript from one that does not, which is
    // how a real one shipped without (docs/features/sharing.md).
    const snapshot = shareSnapshot({ overview, transcript: transcript ?? null, narration: narration ?? null });
    const { note } = snapshot;
    const share: Share = {
      token: ShareToken.parse(token),
      url: `https://overview.test/s/${token}`,
      overviewId: overview.id,
      title: overview.video.title,
      sharedAt: existing?.sharedAt ?? "2026-09-30T11:00:00.000Z",
      updatedAt: "2026-09-30T11:00:00.000Z",
      views: existing?.views ?? 0,
      contentHash: createHash("sha256").update(shareContentSource(note)).digest("hex"),
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
          if (pending(requestId) === null) return notFound();
          if (approve && !canConnectAssistant(this.#accountPlan)) {
            return { status: 403, body: { error: { code: "plan_required", message: "Simulated: needs Plus" } } };
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
      onDefault: () => { status: number; body: unknown };
      onError: () => { status: number; body: unknown };
    },
  ): Promise<void> => {
    this.#callCounts.set(endpoint, this.getCallCount(endpoint) + 1);
    const behaviour = this.#behaviours.get(endpoint) ?? EndpointBehaviour.DEFAULT;

    if (behaviour === EndpointBehaviour.STALL) {
      // Held, not fulfilled or aborted: the request hangs until releaseEndpoint() lets it go.
      this.#stalled.push({ endpoint, route, onDefault: handlers.onDefault });
      return;
    }

    const { status, body } =
      behaviour === EndpointBehaviour.ERROR ? handlers.onError() : handlers.onDefault();
    await route.fulfill({ status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(body) });
  };

  // Seeding and inspection, grouped per domain (frontend-testing-guide.md 4.4). Seeding
  // only queues data for the next mount's hooksConfig; inspection reads the live,
  // browser-side store via page.evaluate, since that's the only real store instance.
  overviews = {
    seed: (overview: Overview): void => {
      this.#seedOverviews.push(overview);
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
    get: (id: OverviewId) =>
      this.#page.evaluate(
        (overviewId) => window.__iwftStores__.overviewStore.getOverview(overviewId),
        id,
      ),
    getState: (id: OverviewId) =>
      this.#page.evaluate(
        (overviewId) => window.__iwftStores__.overviewStore.getOverviewState(overviewId),
        id,
      ),
  };

  // The account as the sync server holds it: what a pull would bring down, and where the
  // server puts its write floor (docs/features/sync-client.md).
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
    // Writes this device made and has not sent yet, as the open library's outbox holds them.
    queueLocalWrites: (entries: OutboxEntry[]) =>
      this.#page.evaluate((queued) => {
        for (const entry of queued) window.__iwftStores__.syncStorage?.seedPending(entry);
      }, entries),
    // How many overviews one of this device's libraries still holds, the no-account one under null.
    overviewsHeldIn: (accountId: string | null) =>
      this.#page.evaluate(
        async (id) => (await window.__iwftLibraries__.get(id)?.overviewStore.listOverviews())?.length ?? 0,
        accountId,
      ),
    // Whether a library was ever enrolled into the account, which is what pushes all of it.
    enrolled: (accountId: string | null) =>
      this.#page.evaluate((id) => window.__iwftLibraries__.get(id)?.syncStorage?.enrolled ?? false, accountId),
    // The browser saying the network is back, which is one of the things that starts a cycle.
    simulateBackOnline: () => this.#page.evaluate(() => window.dispatchEvent(new Event("online"))),
  };

  // The links the reader has given out, as the server holds them (docs/features/sharing.md).
  shares = {
    live: (): Share[] => [...this.#shares.values()],
    // What was actually uploaded behind a link, which is the only way to see that the copy
    // carries everything the reader could see.
    snapshot: (token: string): SharedOverview | null => this.#shareSnapshots.get(token) ?? null,
    // The copy behind the link was made from an earlier note, which is what the stored
    // hash disagreeing with the reader's own means (docs/features/sharing.md).
    simulateCopyIsStale: (): void => {
      for (const [token, share] of this.#shares) {
        this.#shares.set(token, { ...share, contentHash: "stale".padEnd(64, "0") });
      }
    },
  };

  // Sign-in as the server sees it: what was asked for, what was presented, and which
  // shell the link the reader opens was asked for from (docs/features/sign-in.md).
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
    // The server no longer knows the session this device still holds.
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

  // Narration as the server holds it: rendered already, still being made, given up on,
  // or refused because the account has too much waiting (docs/features/audio-player.md).
  narration = {
    seedReady: (overview: Overview, voice: NarrationVoice = DEFAULT_NARRATION_VOICE): void => {
      const lines = spokenScript(overview);
      const key = keyFor(lines, voice);
      this.#renders.set(key, { render: readyRender(key, lines.length), lineCount: lines.length });
    },
    isStored: (overview: Overview, voice: NarrationVoice): boolean =>
      this.#renders.get(keyFor(spokenScript(overview), voice))?.render.status === "ready",
    // One rendered sample per offered voice, as the deploy's release step leaves them.
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
        if (held.render.status !== "ready") held.render = readyRender(key, held.lineCount);
      }
    },
    failRenders: (): void => {
      for (const [key, held] of this.#renders) {
        if (held.render.status !== "ready") held.render = { key, status: "failed" };
      }
    },
    accountIsBusy: (): void => {
      this.#narrationBusy = true;
    },
    requestCount: (): number => this.#narrationPriorities.length,
    requestedPriorities: (): string[] => [...this.#narrationPriorities],
  };

  // An assistant waiting on the reader's answer (docs/features/mcp-connector.md).
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

  // What the app told /api/events, batch by batch and flattened (docs/architecture/analytics.md).
  analytics = {
    batches: (): AnalyticsEventBatch[] => [...this.#eventBatches],
    events: (): Array<{ name: string; props: Record<string, unknown> }> =>
      this.#eventBatches.flatMap(({ events }) => events.map(({ name, props }) => ({ name, props }))),
    eventNames: (): string[] => this.#eventBatches.flatMap(({ events }) => events.map(({ name }) => name)),
    // What a reader without an account saying no told /api/events/declined.
    declines: (): AnalyticsDeclined[] => [...this.#declines],
    // What a shared link's page told /api/shares/:token/events, with the token it was sent under.
    sharedPage: {
      batches: (): Array<{ token: string; batch: SharedPageEventBatch }> => [...this.#sharedPageEventBatches],
      events: (): Array<{ name: string; props: Record<string, unknown> }> =>
        this.#sharedPageEventBatches.flatMap(({ batch }) => batch.events.map(({ name, props }) => ({ name, props }))),
    },
  };

  // What the app told /api/errors, batch by batch and flattened (docs/architecture/errors-and-logs.md).
  errors = {
    batches: (): ClientErrorBatch[] => [...this.#errorBatches],
    reported: (): ClientErrorBatch["errors"] => this.#errorBatches.flatMap(({ errors }) => errors),
  };

  transcripts = {
    seed: (transcript: StoredTranscript): void => {
      this.#seedTranscripts.push(transcript);
    },
    // In the cross-account cache, as though another account had stored it.
    seedShared: (transcript: StoredTranscript): void => {
      this.#sharedTranscripts.set(transcript.videoId, transcript);
    },
    // What our own server answers with for this transcript's video
    // (docs/architecture/server-side-transcripts.md).
    seedService: (transcript: StoredTranscript): void => {
      this.#serviceTranscripts ??= new Map();
      this.#serviceTranscripts.set(transcript.videoId, transcript);
    },
    // A server with its fetching switched off, which says so before anything is asked.
    serviceIsOff: (): void => {
      this.#serviceTranscripts = null;
    },
    isShared: (videoId: VideoId): boolean => this.#sharedTranscripts.has(videoId),
  };

  transcriptStore = {
    getTranscript: (videoId: VideoId) =>
      this.#page.evaluate((id) => window.__iwftStores__.transcriptStore.getTranscript(id), videoId),
  };

  settingsStore = {
    get: () => this.#page.evaluate(() => window.__iwftStores__.settingsStore.get()),
  };

  overviewStore = {
    listOverviews: () =>
      this.#page.evaluate(() => window.__iwftStores__.overviewStore.listOverviews()),
    listTopics: () => this.#page.evaluate(() => window.__iwftStores__.overviewStore.listTopics()),
    getOverviewState: (id: OverviewId) =>
      this.#page.evaluate(
        (overviewId) => window.__iwftStores__.overviewStore.getOverviewState(overviewId),
        id,
      ),
  };
}
