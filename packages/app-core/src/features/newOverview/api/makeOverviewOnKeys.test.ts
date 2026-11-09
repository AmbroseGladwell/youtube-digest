import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, DEFAULT_SECTIONS_ENABLED, OverviewId, VideoId, type ApiErrorCode } from "@overview/domain";
import {
  generateOverviewOf,
  ModelRefusedError,
  ProviderKeyRefusedError,
  ProviderOutOfCreditError,
  SchemaFailureError,
  type GenerationClient,
  type GenerationInput,
} from "@overview/generation";
import { SyncRequestError, type GenerationApi } from "@overview/sync";
import { ChosenModelFailedError } from "./ChosenModelFailedError.js";
import { makeOverviewOnKeys, type GenerationAttempt } from "./makeOverviewOnKeys.js";

const input: GenerationInput = {
  video: {
    id: VideoId.parse("example"),
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: null,
    publishedAt: null,
    thumbnailUrl: null,
  },
  transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
  captureReason: null,
  readerContext: null,
  sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, verdict: false, selling: false, watchAnyway: false },
  existingTopics: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
};

const meta = { id: OverviewId.parse(crypto.randomUUID()), savedAt: "2026-10-21T09:00:00.000Z" };

const answer = (inOneLine: string) => ({
  inOneLine,
  coreClaim: "The core claim.",
  thin: false,
  keyPoints: [
    { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
  ],
  chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
  matchedTopicNames: [],
  suggestedTopic: null,
  recipe: null,
  tags: ["one-tag", "two-tag", "three-tag"],
  howToApply: { items: [] },
});

const ownClient =
  (outcome: "made" | Error): GenerationClient =>
  async () => {
    if (outcome instanceof Error) throw outcome;
    return answer("Made on the reader's key.");
  };

const refusal = (code: ApiErrorCode, details?: Record<string, unknown>) =>
  new SyncRequestError(code, API_ERROR_CODES[code], `simulated ${code}`, details);

// Our server as the device meets it: each call recorded, our key answering with the
// overview it made or the refusal it was told to give, reservations likewise.
function fakeServer({ generate, reserve }: { generate?: Error; reserve?: Error } = {}) {
  const calls: string[] = [];
  const api: GenerationApi = {
    status: async () => ({ available: true }),
    profilePass: async () => ({ items: [] }),
    forAnyone: async () => ({ items: [] }),
    topics: async () => ({ names: [] }),
    topicSuggestions: async () => ({ starter: [], newTopic: null }),
    usage: async () => {
      throw new Error("not asked");
    },
    generate: async ({ input: sent }) => {
      calls.push("generate");
      if (generate !== undefined) throw generate;
      return generateOverviewOf(async () => answer("Made on our key."), sent, meta);
    },
    reserve: async () => {
      calls.push("reserve");
      if (reserve !== undefined) throw reserve;
      return { plan: "free", resetsOn: "2026-11-01", ours: { used: 0, limit: 5 }, own: { used: 1, limit: 10 } };
    },
    release: async () => {
      calls.push("release");
    },
    startTrial: async () => ({ token: "trial-token" }),
  };
  return { api, calls };
}

describe("makeOverviewOnKeys", () => {
  it("makes it on the reader's key when that comes first, reserving the slot before, and says no key was passed over", async () => {
    const { api, calls } = fakeServer();

    const overview = await makeOverviewOnKeys(
      { order: ["own", "ours"], own: { provider: "anthropic", model: "a-model", client: ownClient("made") }, api },
      input,
      meta,
    );

    expect(overview.inOneLine).toBe("Made on the reader's key.");
    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
    expect(calls).toEqual(["reserve"]);
  });

  it("moves to our key when the reader's is out of credit, gives the own slot back, and says why", async () => {
    const { api, calls } = fakeServer();

    const overview = await makeOverviewOnKeys(
      {
        order: ["own", "ours"],
        own: { provider: "anthropic", model: "a-model", client: ownClient(new ProviderOutOfCreditError(400, "credit")) },
        api,
      },
      input,
      meta,
    );

    expect(overview.inOneLine).toBe("Made on our key.");
    expect(overview.madeOn).toEqual({ key: "ours", fallback: { from: "own", provider: "anthropic", cause: "out-of-credit" } });
    expect(calls).toEqual(["reserve", "release", "generate"]);
  });

  it("moves to our key when the own-key month is spent, without generating on the reader's key", async () => {
    const { api, calls } = fakeServer({ reserve: refusal("too_many_requests", { quota: "own", resetsOn: "2026-11-01" }) });

    const overview = await makeOverviewOnKeys(
      { order: ["own", "ours"], own: { provider: "openai", model: "a-model", client: ownClient(new Error("must not be asked")) }, api },
      input,
      meta,
    );

    expect(overview.madeOn?.fallback).toEqual({ from: "own", provider: "openai", cause: "quota-spent" });
    expect(calls).toEqual(["reserve", "generate"]);
  });

  it("never moves on a refused key, so the reader sees the key problem", async () => {
    const { api, calls } = fakeServer();

    await expect(
      makeOverviewOnKeys(
        {
          order: ["own", "ours"],
          own: { provider: "anthropic", model: "a-model", client: ownClient(new ProviderKeyRefusedError("refused")) },
          api,
        },
        input,
        meta,
      ),
    ).rejects.toBeInstanceOf(ProviderKeyRefusedError);
    expect(calls).toEqual(["reserve", "release"]);
  });

  it("a model the provider refuses fails as the reader's chosen model, naming provider and model, without moving", async () => {
    const { api, calls } = fakeServer();
    const refused = new ModelRefusedError(400, '{"type":"error","error":{"message":"The compiled grammar is too large"}}');

    const error = await makeOverviewOnKeys(
      { order: ["own", "ours"], own: { provider: "anthropic", model: "claude-haiku-5-5", client: ownClient(refused) }, api },
      input,
      meta,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ChosenModelFailedError);
    expect(error).toMatchObject({ provider: "anthropic", model: "claude-haiku-5-5", reason: "refused", status: 400, cause: refused });
    expect(calls).toEqual(["reserve", "release"]);
  });

  it("an answer that keeps breaking the schema still moves to our key, and fails as the chosen model only on the last key", async () => {
    const own = { provider: "openai" as const, model: "gpt-6-luna", client: ownClient(new SchemaFailureError("still invalid")) };

    const moved = await makeOverviewOnKeys({ order: ["own", "ours"], own, api: fakeServer().api }, input, meta);
    expect(moved.madeOn).toEqual({ key: "ours", fallback: { from: "own", provider: "openai", cause: "schema-failure" } });

    await expect(makeOverviewOnKeys({ order: ["own"], own, api: fakeServer().api }, input, meta)).rejects.toMatchObject({
      provider: "openai",
      model: "gpt-6-luna",
      reason: "schema",
      status: null,
    });
  });

  it("tries our key first on Plus and moves to the reader's when our month is spent", async () => {
    const { api } = fakeServer({ generate: refusal("too_many_requests", { quota: "ours", resetsOn: "2026-11-01" }) });

    const overview = await makeOverviewOnKeys(
      { order: ["ours", "own"], own: { provider: "anthropic", model: "a-model", client: ownClient("made") }, api },
      input,
      meta,
    );

    expect(overview.madeOn).toEqual({ key: "own", fallback: { from: "ours", provider: "anthropic", cause: "quota-spent" } });
  });

  it("moves on our key's daily cap as busy, and on a failure our server says may move", async () => {
    const busy = fakeServer({ generate: refusal("too_many_requests", { quota: "our-key-daily", retryAfterSeconds: 60 }) });
    const broken = fakeServer({ generate: refusal("generation_failed", { fallback: "schema-failure" }) });
    const own = { provider: "anthropic" as const, model: "a-model", client: ownClient("made") };

    expect((await makeOverviewOnKeys({ order: ["ours", "own"], own, api: busy.api }, input, meta)).madeOn?.fallback?.cause).toBe("busy");
    expect((await makeOverviewOnKeys({ order: ["ours", "own"], own, api: broken.api }, input, meta)).madeOn?.fallback?.cause).toBe(
      "schema-failure",
    );
  });

  it("fails with the last key's own reason when no key is left to move to", async () => {
    const { api } = fakeServer({ generate: refusal("too_many_requests", { quota: "ours", resetsOn: "2026-11-01" }) });

    await expect(
      makeOverviewOnKeys(
        {
          order: ["own", "ours"],
          own: { provider: "anthropic", model: "a-model", client: ownClient(new ProviderOutOfCreditError(400, "credit")) },
          api,
        },
        input,
        meta,
      ),
    ).rejects.toMatchObject({ code: "too_many_requests" });
  });

  it("still makes it on the reader's key when the server can't be reached to reserve, leaving the push to reserve", async () => {
    const { api } = fakeServer({ reserve: new TypeError("Failed to fetch") });

    const overview = await makeOverviewOnKeys(
      { order: ["own"], own: { provider: "anthropic", model: "a-model", client: ownClient("made") }, api },
      input,
      meta,
    );

    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
  });

  it("signed out, nothing is reserved or counted by the server", async () => {
    const overview = await makeOverviewOnKeys(
      { order: ["own"], own: { provider: "anthropic", model: "a-model", client: ownClient("made") }, api: null },
      input,
      meta,
    );

    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
  });

  it("signed out, our key goes through the device's trial, with nothing reserved", async () => {
    const { api, calls } = fakeServer();

    const overview = await makeOverviewOnKeys({ order: ["ours"], own: null, api: null, trial: api }, input, meta);

    expect(overview.madeOn).toEqual({ key: "ours", fallback: null });
    expect(calls).toEqual(["generate"]);
  });

  it("signed out, a trial spent on our key, or on this address today, moves to the reader's own key", async () => {
    for (const quota of ["trial", "trial-address"]) {
      const { api } = fakeServer({ generate: refusal("too_many_requests", { quota }) });

      const overview = await makeOverviewOnKeys(
        { order: ["ours", "own"], own: { provider: "anthropic", model: "a-model", client: ownClient("made") }, api: null, trial: api },
        input,
        meta,
      );

      expect(overview.madeOn?.fallback?.cause).toBe("quota-spent");
    }
  });

  describe("says each key as it tries it, for analytics", () => {
    const ourModel = { provider: "openai" as const, model: "gpt-6.1-sol" };
    const own = { provider: "anthropic" as const, model: "claude-sonnet-5-5", client: ownClient("made") };
    const tried = () => {
      const attempts: GenerationAttempt[] = [];
      return { attempts, meta: { ...meta, onAttempt: (attempt: GenerationAttempt) => attempts.push(attempt) } };
    };

    it("names the reader's provider and model on their own key", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await makeOverviewOnKeys({ order: ["own", "ours"], own, api, ourModel }, input, watched);

      expect(attempts).toEqual([{ key: "own", provider: "anthropic", model: "claude-sonnet-5-5" }]);
    });

    it("names our provider and model on our key, as the server said them", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await makeOverviewOnKeys({ order: ["ours"], own: null, api, ourModel }, input, watched);

      expect(attempts).toEqual([{ key: "ours", ...ourModel }]);
    });

    it("names our key through a signed-out device's trial as the trial", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await makeOverviewOnKeys({ order: ["ours"], own: null, api: null, trial: api, ourModel }, input, watched);

      expect(attempts).toEqual([{ key: "trial", ...ourModel }]);
    });

    it("leaves our provider and model out when the server didn't say them", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await makeOverviewOnKeys({ order: ["ours"], own: null, api }, input, watched);

      expect(attempts).toEqual([{ key: "ours", provider: undefined, model: undefined }]);
    });

    it("ends on the key that made it after a fallback, not the one tried first", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await makeOverviewOnKeys(
        { order: ["own", "ours"], own: { ...own, client: ownClient(new ProviderOutOfCreditError(400, "credit")) }, api, ourModel },
        input,
        watched,
      );

      expect(attempts.at(-1)).toEqual({ key: "ours", ...ourModel });
    });

    it("ends on the key that failed when none could make it", async () => {
      const { api } = fakeServer();
      const { attempts, meta: watched } = tried();

      await expect(
        makeOverviewOnKeys(
          { order: ["own"], own: { ...own, client: ownClient(new ProviderKeyRefusedError("refused")) }, api, ourModel },
          input,
          watched,
        ),
      ).rejects.toThrow();

      expect(attempts.at(-1)).toEqual({ key: "own", provider: "anthropic", model: "claude-sonnet-5-5" });
    });
  });
});
