import type { Page, Route } from "@playwright/test";
import {
  CLIENT_VERSION,
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
  #linkSurface: AuthSurface = "web";
  #accountFirstName: string | null = null;

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
        onDefault: () => ({
          status: 200,
          body: { token: SIMULATED_BEARER, email: SIMULATED_EMAIL, firstName: this.#accountFirstName, expiresAt },
        }),
        onError: spent,
      }),
    );

    await this.#page.route("**/api/session/link-code", (route) =>
      this.#respond(route, EndpointKey.SESSION_LINK_CODE, {
        onDefault: () => ({
          status: 200,
          body: { linkCode: SIMULATED_LINK_CODE, linkCodeExpiresAt: "2026-09-26T09:10:00.000Z" },
        }),
        onError: unauthenticated,
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
    linkWasAskedForFrom: (surface: AuthSurface): void => {
      this.#linkSurface = surface;
    },
    accountIsNamed: (firstName: string): void => {
      this.#accountFirstName = firstName;
    },
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
