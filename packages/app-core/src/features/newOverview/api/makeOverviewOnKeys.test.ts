import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, DEFAULT_SECTIONS_ENABLED, OverviewId, VideoId, type ApiErrorCode } from "@overview/domain";
import {
  generateOverview,
  ProviderKeyRefusedError,
  ProviderOutOfCreditError,
  type GenerationClient,
  type GenerationInput,
} from "@overview/generation";
import { SyncRequestError, type GenerationApi } from "@overview/sync";
import { makeOverviewOnKeys } from "./makeOverviewOnKeys.js";

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
  keyPoints: [{ text: "one", range: null }, { text: "two", range: null }, { text: "three", range: null }],
  chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: ["one-tag", "two-tag", "three-tag"],
  howToApply: { items: [] },
});

const ownClient = (outcome: "made" | Error): GenerationClient => async () => {
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
    usage: async () => {
      throw new Error("not asked");
    },
    generate: async ({ input: sent }) => {
      calls.push("generate");
      if (generate !== undefined) throw generate;
      return generateOverview(async () => answer("Made on our key."), sent, meta);
    },
    reserve: async () => {
      calls.push("reserve");
      if (reserve !== undefined) throw reserve;
      return { plan: "free", resetsOn: "2026-11-01", ours: { used: 0, limit: 5 }, own: { used: 1, limit: 10 } };
    },
    release: async () => {
      calls.push("release");
    },
  };
  return { api, calls };
}

describe("makeOverviewOnKeys", () => {
  it("makes it on the reader's key when that comes first, reserving the slot before, and says no key was passed over", async () => {
    const { api, calls } = fakeServer();

    const overview = await makeOverviewOnKeys({ order: ["own", "ours"], own: { provider: "anthropic", client: ownClient("made") }, api }, input, meta);

    expect(overview.inOneLine).toBe("Made on the reader's key.");
    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
    expect(calls).toEqual(["reserve"]);
  });

  it("moves to our key when the reader's is out of credit, gives the own slot back, and says why", async () => {
    const { api, calls } = fakeServer();

    const overview = await makeOverviewOnKeys(
      { order: ["own", "ours"], own: { provider: "anthropic", client: ownClient(new ProviderOutOfCreditError(400, "credit")) }, api },
      input,
      meta,
    );

    expect(overview.inOneLine).toBe("Made on our key.");
    expect(overview.madeOn).toEqual({ key: "ours", fallback: { from: "own", provider: "anthropic", cause: "out-of-credit" } });
    expect(calls).toEqual(["reserve", "release", "generate"]);
  });

  it("moves to our key when the own-key month is spent, without generating on the reader's key", async () => {
    const { api, calls } = fakeServer({ reserve: refusal("too_many_requests", { quota: "own", resetsOn: "2026-11-01" }) });

    const overview = await makeOverviewOnKeys({ order: ["own", "ours"], own: { provider: "openai", client: ownClient(new Error("must not be asked")) }, api }, input, meta);

    expect(overview.madeOn?.fallback).toEqual({ from: "own", provider: "openai", cause: "quota-spent" });
    expect(calls).toEqual(["reserve", "generate"]);
  });

  it("never moves on a refused key, so the reader sees the key problem", async () => {
    const { api, calls } = fakeServer();

    await expect(
      makeOverviewOnKeys({ order: ["own", "ours"], own: { provider: "anthropic", client: ownClient(new ProviderKeyRefusedError("refused")) }, api }, input, meta),
    ).rejects.toBeInstanceOf(ProviderKeyRefusedError);
    expect(calls).toEqual(["reserve", "release"]);
  });

  it("tries our key first on Plus and moves to the reader's when our month is spent", async () => {
    const { api } = fakeServer({ generate: refusal("too_many_requests", { quota: "ours", resetsOn: "2026-11-01" }) });

    const overview = await makeOverviewOnKeys({ order: ["ours", "own"], own: { provider: "anthropic", client: ownClient("made") }, api }, input, meta);

    expect(overview.madeOn).toEqual({ key: "own", fallback: { from: "ours", provider: "anthropic", cause: "quota-spent" } });
  });

  it("moves on our key's daily cap as busy, and on a failure our server says may move", async () => {
    const busy = fakeServer({ generate: refusal("too_many_requests", { quota: "our-key-daily", retryAfterSeconds: 60 }) });
    const broken = fakeServer({ generate: refusal("generation_failed", { fallback: "schema-failure" }) });
    const own = { provider: "anthropic" as const, client: ownClient("made") };

    expect((await makeOverviewOnKeys({ order: ["ours", "own"], own, api: busy.api }, input, meta)).madeOn?.fallback?.cause).toBe("busy");
    expect((await makeOverviewOnKeys({ order: ["ours", "own"], own, api: broken.api }, input, meta)).madeOn?.fallback?.cause).toBe("schema-failure");
  });

  it("fails with the last key's own reason when no key is left to move to", async () => {
    const { api } = fakeServer({ generate: refusal("too_many_requests", { quota: "ours", resetsOn: "2026-11-01" }) });

    await expect(
      makeOverviewOnKeys({ order: ["own", "ours"], own: { provider: "anthropic", client: ownClient(new ProviderOutOfCreditError(400, "credit")) }, api }, input, meta),
    ).rejects.toMatchObject({ code: "too_many_requests" });
  });

  it("still makes it on the reader's key when the server can't be reached to reserve, leaving the push to reserve", async () => {
    const { api } = fakeServer({ reserve: new TypeError("Failed to fetch") });

    const overview = await makeOverviewOnKeys({ order: ["own"], own: { provider: "anthropic", client: ownClient("made") }, api }, input, meta);

    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
  });

  it("signed out, nothing is reserved or counted by the server", async () => {
    const overview = await makeOverviewOnKeys({ order: ["own"], own: { provider: "anthropic", client: ownClient("made") }, api: null }, input, meta);

    expect(overview.madeOn).toEqual({ key: "own", fallback: null });
  });
});
