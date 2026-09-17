import type { Page, Route } from "@playwright/test";
import type { Overview, OverviewId, OverviewState, StoredTranscript, Topic, VideoId } from "@overview/types";
import { EndpointBehaviour, EndpointKey } from "./EndpointKey.testHelper.js";
import type { IwftHooksConfig } from "./IwftHooksConfig.testHelper.js";
import { makeAnthropicMessageResponse, makeGeneratedOutputFixture } from "./fixtures/anthropicFixtures.js";
import { makeMetadataFixture, makeTranscriptFixture } from "./fixtures/supadataFixtures.js";
import type {} from "./iwftWindow.testHelper.js";

export class BackendSimulator {
  #page: Page;
  #seedOverviews: Overview[] = [];
  #seedStates: OverviewState[] = [];
  #seedTopics: Topic[] = [];
  #seedTranscripts: StoredTranscript[] = [];

  #behaviours = new Map<EndpointKey, EndpointBehaviour>(
    Object.values(EndpointKey).map((key) => [key, EndpointBehaviour.DEFAULT]),
  );
  #callCounts = new Map<EndpointKey, number>();
  #stalled: Array<{ endpoint: EndpointKey; route: Route; onDefault: () => { status: number; body: unknown } }> = [];
  #generatedOutputOverrides: Record<string, unknown> = {};

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
    seedTopics: this.#seedTopics,
    seedTranscripts: this.#seedTranscripts,
  });

  handleNetworking = async (): Promise<void> => {
    await this.#page.route("**/api.supadata.ai/v1/metadata**", (route) =>
      this.#respond(route, EndpointKey.SUPADATA_METADATA, {
        onDefault: () => ({ status: 200, body: makeMetadataFixture() }),
        onError: () => ({
          status: 401,
          body: { error: "invalid-request", message: "Unauthorized", details: "Simulated auth failure" },
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
          body: { type: "error", error: { type: "authentication_error", message: "Simulated auth failure" } },
        }),
      }),
    );
  };

  #respond = async (
    route: Route,
    endpoint: EndpointKey,
    handlers: { onDefault: () => { status: number; body: unknown }; onError: () => { status: number; body: unknown } },
  ): Promise<void> => {
    this.#callCounts.set(endpoint, this.getCallCount(endpoint) + 1);
    const behaviour = this.#behaviours.get(endpoint) ?? EndpointBehaviour.DEFAULT;

    if (behaviour === EndpointBehaviour.STALL) {
      // Held, not fulfilled or aborted: the request hangs until releaseEndpoint() lets it go.
      this.#stalled.push({ endpoint, route, onDefault: handlers.onDefault });
      return;
    }

    const { status, body } = behaviour === EndpointBehaviour.ERROR ? handlers.onError() : handlers.onDefault();
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
    get: (id: OverviewId) =>
      this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.getOverview(overviewId), id),
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

  overviewStore = {
    listOverviews: () => this.#page.evaluate(() => window.__iwftStores__.overviewStore.listOverviews()),
    getOverviewState: (id: OverviewId) =>
      this.#page.evaluate((overviewId) => window.__iwftStores__.overviewStore.getOverviewState(overviewId), id),
  };
}
