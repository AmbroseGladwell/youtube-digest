import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import {
  CLIENT_VERSION,
  DEFAULT_NARRATION_VOICE,
  narrationKeySource,
  spokenScript,
  type NarrationRender,
  type AuthSurface,
  type MagicLinkRequest,
  type Overview,
  type OverviewId,
  type OverviewState,
  type RecordChange,
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
import { makeMetadataFixture, makeTranscriptFixture } from "./fixtures/supadataFixtures.js";
import {
  makeJson3Fixture,
  makeMicroformatFixture,
  makePlayerResponseFixture,
} from "./fixtures/innerTubeFixtures.js";
import type {} from "./iwftWindow.testHelper.js";

// What the simulated server hands a signed-in reader (docs/features/sign-in.md).
export const SIMULATED_EMAIL = "reader@example.com";
export const SIMULATED_LINK_CODE = "ABCD-EFGH";
export const SIMULATED_BEARER = "linked-session-token";

// Every line of simulated narration lasts this long, so a test can say where a line starts.
export const SIMULATED_SECONDS_PER_LINE = 2;

const keyFor = (lines: string[], voice: string) =>
  createHash("sha256").update(narrationKeySource(lines, voice)).digest("hex");

const readyRender = (key: string, lineCount: number): NarrationRender => ({
  key,
  status: "ready",
  lineStartsSeconds: Array.from({ length: lineCount }, (_, index) => index * SIMULATED_SECONDS_PER_LINE),
  durationSeconds: lineCount * SIMULATED_SECONDS_PER_LINE,
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
  #stalled: Array<{
    endpoint: EndpointKey;
    route: Route;
    onDefault: () => { status: number; body: unknown };
  }> = [];
  #generatedOutputOverrides: Record<string, unknown> = {};
  #feed: RecordChange[] = [];
  #accountTranscripts = new Map<string, StoredTranscript>();
  #minSupportedClientVersion = 1;
  #magicLinkRequests: MagicLinkRequest[] = [];
  #signInAttempts: string[] = [];
  #linkCodeServers: string[] = [];
  #linkSurface: AuthSurface = "web";
  #accountFirstName: string | null = null;
  #sessionHasEnded = false;
  #renders = new Map<string, { render: NarrationRender; lineCount: number }>();
  #narrationBusy = false;
  #narrationRequests = 0;

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

    await this.#page.route("**/api.supadata.ai/v1/metadata**", (route) =>
      this.#respond(route, EndpointKey.SUPADATA_METADATA, {
        onDefault: () => ({ status: 200, body: makeMetadataFixture() }),
        onError: () => ({
          status: 401,
          body: {
            error: "invalid-request",
            message: "Unauthorized",
            details: "Simulated auth failure",
          },
        }),
      }),
    );

    await this.#page.route("**/api.supadata.ai/v1/transcript**", (route) =>
      this.#respond(route, EndpointKey.SUPADATA_TRANSCRIPT, {
        onDefault: () => ({ status: 200, body: makeTranscriptFixture() }),
        onError: () => ({
          status: 400,
          body: { error: "invalid-request", message: "Simulated transcript failure", details: "" },
        }),
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
                : { surface: "web", email: SIMULATED_EMAIL, firstName: this.#accountFirstName, expiresAt },
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
            body: { token: SIMULATED_BEARER, email: SIMULATED_EMAIL, firstName: this.#accountFirstName, expiresAt },
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
        : route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              accountId: "account",
              email: SIMULATED_EMAIL,
              firstName: this.#accountFirstName,
              expiresAt,
            }),
          }),
    );

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

    const unavailable = () => ({
      status: 503,
      body: { error: { code: "unavailable", message: "Simulated: narration is not set up" } },
    });

    await this.#page.route("**/api/audio", (route) =>
      this.#respond(route, EndpointKey.NARRATION_REQUEST, {
        onDefault: () => {
          this.#narrationRequests += 1;
          const { lines, voice } = route.request().postDataJSON() as { lines: string[]; voice: string };
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

    await this.#page.route("**/api/audio/*", (route) =>
      this.#respond(route, EndpointKey.NARRATION_STATUS, {
        onDefault: () => {
          const key = new URL(route.request().url()).pathname.split("/").at(-1)!;
          const held = this.#renders.get(key);
          return held === undefined
            ? { status: 404, body: { error: { code: "not_found", message: "Simulated: never asked for" } } }
            : { status: 200, body: held.render };
        },
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
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
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
  };

  // Sign-in as the server sees it: what was asked for, what was presented, and which
  // shell the link the reader opens was asked for from (docs/features/sign-in.md).
  auth = {
    magicLinkRequests: (): MagicLinkRequest[] => [...this.#magicLinkRequests],
    signInAttempts: (): string[] => [...this.#signInAttempts],
    linkCodeServers: (): string[] => [...this.#linkCodeServers],
    linkWasAskedForFrom: (surface: AuthSurface): void => {
      this.#linkSurface = surface;
    },
    accountIsNamed: (firstName: string): void => {
      this.#accountFirstName = firstName;
    },
    sessionHasEnded: (): void => {
      this.#sessionHasEnded = true;
      this.simulateEndpointError(EndpointKey.SESSION_LINK_CODE);
    },
  };

  // Narration as the server holds it: rendered already, still being made, given up on,
  // or refused because the account has too much waiting (docs/features/audio-player.md).
  narration = {
    seedReady: (overview: Overview): void => {
      const lines = spokenScript(overview);
      const key = keyFor(lines, DEFAULT_NARRATION_VOICE);
      this.#renders.set(key, { render: readyRender(key, lines.length), lineCount: lines.length });
    },
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
    requestCount: (): number => this.#narrationRequests,
  };

  transcripts = {
    seed: (transcript: StoredTranscript): void => {
      this.#seedTranscripts.push(transcript);
    },
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
