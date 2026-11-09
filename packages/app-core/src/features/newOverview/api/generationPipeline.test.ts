import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  articleSourceId,
  type ArticleRead,
  type ClaimSummary,
  type Overview,
  type OverviewId,
  type OverviewStore,
  type Settings,
  type StoredTranscript,
  type Topic,
  type TranscriptStore,
  type AboutYou,
  type ClientTimingReport,
  type LearnedItems,
} from "@overview/domain";
import type { GenerationInput } from "@overview/generation";
import { makeArticleOverview, makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";
import { ArticleAlreadyHeldError } from "./ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./ArticleReadError.js";
import { GenerationCancelledError } from "./GenerationCancelledError.js";
import { runArticleOverviewGeneration, runOverviewGeneration, type GenerationPipelineDeps } from "./generationPipeline.js";

const VIDEO = makeOverview().source;

const makeDeps = ({ held = true }: { held?: boolean } = {}) => {
  const topics: Topic[] = [];
  let settings: Settings = DEFAULT_SETTINGS;
  const inputs: GenerationInput[] = [];
  const timings: ClientTimingReport[] = [];
  const library: Overview[] = [];
  const claims: ClaimSummary[] = [];
  const saved: Overview[] = [];
  let clock = 0;
  const stored: StoredTranscript = {
    videoId: VIDEO.id!,
    segments: [{ startMs: 0, endMs: 4_000, text: "Three cuts cover most of a week." }],
    generated: false,
    fetchedAt: new Date().toISOString(),
    video: VIDEO,
  };
  const deps: GenerationPipelineDeps = {
    sources: [],
    transcriptStore: {
      getTranscript: async () => (held ? stored : null),
      saveTranscript: async () => {},
      deleteTranscript: async () => {},
    } satisfies TranscriptStore,
    overviewStore: {
      listTopics: async () => [...topics],
      listClaims: async () => [...claims],
      listOverviews: async () => [...library],
      getOverview: async (id: OverviewId) => library.find((overview) => overview.id === id) ?? null,
      saveOverview: async (overview: Overview) => {
        saved.push(overview);
      },
    } as unknown as OverviewStore,
    settingsStore: { get: async () => settings },
    makeOverview: async (input, { id }) => {
      inputs.push(input as GenerationInput);
      clock += 41_000;
      return makeOverview({ id });
    },
    timed: (timing) => timings.push(timing),
    now: () => clock,
  };
  const rung = (tier: TranscriptSource["tier"], answer: "answers" | "no-answer" | "throws", ms: number): TranscriptSource => ({
    tier,
    cost: "free",
    isReady: async () => true,
    resolve: async () => {
      clock += ms;
      if (answer === "throws") throw new Error("Simulated: the rung failed");
      return answer === "no-answer" ? null : { video: VIDEO, transcript: stored.segments, generated: false };
    },
  });
  return {
    deps,
    inputs,
    timings,
    saved,
    rung,
    hold: (overview: Overview) => {
      library.push(overview);
      claims.push({ overviewId: overview.id, title: overview.source.title, claim: overview.coreClaim });
    },
    tick: (ms: number) => (clock += ms),
    addTopic: (topic: Topic) => topics.push(topic),
    setAboutYou: (aboutYou: AboutYou) => (settings = { ...settings, aboutYou }),
    setLearned: (learned: LearnedItems) => (settings = { ...settings, learned }),
  };
};

describe("runOverviewGeneration", () => {
  it("waits to write until told, and writes with the topics and reader context chosen meanwhile", async () => {
    const { deps, inputs, addTopic, setAboutYou } = makeDeps();
    let startWriting!: () => void;
    const answered = new Promise<void>((resolve) => (startWriting = resolve));
    let fetched = false;

    const run = runOverviewGeneration(VIDEO.url, deps, {
      onProgress: () => (fetched = true),
      waitToWrite: () => answered,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetched).toBe(true);
    expect(inputs).toEqual([]);

    const food = makeTopic({ name: "Food", description: "Cooking, recipes and eating well." });
    addTopic(food);
    setAboutYou({ who: ["nurse"], time: [], focus: ["new recipes"] });
    startWriting();
    await run;

    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.existingTopics).toEqual([food]);
    expect(inputs[0]!.readerContext).toBe("I'm a nurse, and right now I'm focusing on new recipes.");
  });

  it("times each rung asked, the model and the save on its own clock, and reports the whole however it was answered", async () => {
    const { deps, timings, rung } = makeDeps({ held: false });
    const reported: ClientTimingReport[] = [];

    await runOverviewGeneration(
      VIDEO.url,
      { ...deps, sources: [rung("shared-cache", "no-answer", 310), rung("extension", "throws", 1_200), rung("service", "answers", 2_900)] },
      { onTimed: (timing) => reported.push(timing) },
    );

    expect(timings).toEqual([
      {
        name: "captureTimed",
        outcome: "finished",
        steps: [
          { step: "stored", outcome: "no-answer", ms: 0 },
          { step: "shared-cache", outcome: "no-answer", ms: 310 },
          { step: "extension", outcome: "failed", ms: 1_200 },
          { step: "service", outcome: "answered", ms: 2_900 },
          { step: "model", outcome: "answered", ms: 41_000 },
          { step: "save", outcome: "answered", ms: 0 },
        ],
        totalMs: 45_410,
        transcriptCharacters: "Three cuts cover most of a week.".length,
      },
    ]);
    expect(reported).toEqual(timings);
  });

  it("times a capture answered from the store too, since the model is still asked, with no entry for a rung never reached", async () => {
    const { deps, timings, rung } = makeDeps();

    await runOverviewGeneration(VIDEO.url, { ...deps, sources: [rung("shared-cache", "answers", 310)] });

    expect(timings[0]!.steps.map(({ step }) => step)).toEqual(["stored", "model", "save"]);
  });

  it("reports a cancelled capture as such, with the steps it got through", async () => {
    const { deps, timings, inputs } = makeDeps();
    let cancelled = false;

    const run = runOverviewGeneration(VIDEO.url, deps, {
      isCancelled: () => cancelled,
      waitToWrite: async () => {
        cancelled = true;
      },
    });

    await expect(run).rejects.toBeInstanceOf(GenerationCancelledError);
    expect(inputs).toEqual([]);
    expect(timings).toEqual([expect.objectContaining({ outcome: "cancelled", steps: [{ step: "stored", outcome: "answered", ms: 0 }] })]);
  });

  it("reports a failed capture with the step that failed, and no characters when no transcript came", async () => {
    const { deps, timings, rung } = makeDeps({ held: false });

    const run = runOverviewGeneration(VIDEO.url, { ...deps, sources: [rung("service", "throws", 2_900)] });

    await expect(run).rejects.toThrow();
    expect(timings).toEqual([
      expect.objectContaining({
        outcome: "failed",
        transcriptCharacters: 0,
        steps: [
          { step: "stored", outcome: "no-answer", ms: 0 },
          { step: "service", outcome: "failed", ms: 2_900 },
        ],
      }),
    ]);
  });

  it("writes for what was learned and shown as well as the sentence, and leaves out a removed item and one not yet shown", async () => {
    const { deps, inputs, setAboutYou, setLearned } = makeDeps();
    const learnedItem = { source: "From 2 overviews", learnedAt: "2026-11-01T10:00:00.000Z", noticedAt: "2026-11-01T11:00:00.000Z" };
    setAboutYou({ who: ["nurse"], time: [], focus: [] });
    setLearned({
      "building an app": { ...learnedItem, text: "building an app", removedAt: null },
      "saving for a home": { ...learnedItem, text: "saving for a home", removedAt: "2026-11-02T10:00:00.000Z" },
      "running a marathon": { ...learnedItem, text: "running a marathon", noticedAt: null, removedAt: null },
    });

    await runOverviewGeneration(VIDEO.url, deps);

    expect(inputs[0]!.readerContext).toBe("I'm a nurse. Also: building an app.");
  });
});

const ARTICLE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const READ: ArticleRead = {
  status: "read",
  article: {
    url: ARTICLE_URL,
    title: "The town that pays its bridge bill twice",
    siteName: "The Harbour Post",
    author: null,
    publishedAt: null,
    language: "en",
    imageUrl: null,
    sections: [{ heading: null, anchor: null, text: "The county reused a survey." }],
    wordCount: 3200,
    recipe: null,
  },
};

describe("regenerating", () => {
  it("rewrites what the model wrote and keeps what the reader did: the reason, topics, tags, saved date and playlist", async () => {
    const { deps, saved, hold } = makeDeps();
    const previous = makeOverview({
      captureReason: "For the Thursday meeting.",
      topicIds: [makeTopic().id],
      tags: ["my-own-tag"],
      savedAt: "2026-01-02T03:04:05.000Z",
      fromPlaylist: { id: "PLsavedtalks", title: "Saved talks" } as Overview["fromPlaylist"],
      coreClaim: "The old claim.",
    });
    hold(previous);

    await runOverviewGeneration(VIDEO.url, deps, { overviewId: previous.id, captureReason: () => "For the Thursday meeting." });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: previous.id,
      captureReason: "For the Thursday meeting.",
      topicIds: previous.topicIds,
      tags: ["my-own-tag"],
      savedAt: "2026-01-02T03:04:05.000Z",
      fromPlaylist: previous.fromPlaylist,
    });
    expect(saved[0]!.coreClaim).not.toBe("The old claim.");
  });

  it("never offers the overview's own old claim as one it might be similar to", async () => {
    const { deps, inputs, hold } = makeDeps();
    const previous = makeOverview();
    const other = makeOverview();
    hold(previous);
    hold(other);

    await runOverviewGeneration(VIDEO.url, deps, { overviewId: previous.id });

    expect(inputs[0]!.pastClaims.map((claim) => claim.overviewId)).toEqual([other.id]);
  });

  it("regenerates an unreadable record whole, since there is nothing left to keep", async () => {
    const { deps, saved } = makeDeps();
    const id = makeOverview().id;
    deps.overviewStore.getOverview = async () => {
      throw new Error("Simulated: the record can't be read");
    };

    await runOverviewGeneration(VIDEO.url, deps, { overviewId: id });

    expect(saved.map((overview) => overview.id)).toEqual([id]);
  });

  it("clears the reason when the reader emptied it during the run", async () => {
    const { deps, saved, hold } = makeDeps();
    const previous = makeOverview({ captureReason: "Old reason." });
    hold(previous);

    await runOverviewGeneration(VIDEO.url, deps, { overviewId: previous.id, captureReason: () => "" });

    expect(saved[0]!.captureReason).toBeNull();
  });
});

describe("runArticleOverviewGeneration", () => {
  const withLibrary = (held: boolean) => {
    const made: unknown[] = [];
    const overview = makeArticleOverview();
    const store = {
      listTopics: async () => [],
      listClaims: async () => [],
      listUnreadable: async () => [],
      getOverview: async () => null,
      saveOverview: async () => {},
      listOverviews: async () => (held ? [{ ...overview, source: { ...overview.source, id: heldId } }] : []),
    } as unknown as OverviewStore;
    const makeIt: GenerationPipelineDeps["makeOverview"] = async (input, { id }) => {
      made.push(input);
      return makeArticleOverview({ id });
    };
    return { deps: { overviewStore: store, settingsStore: { get: async () => DEFAULT_SETTINGS }, makeOverview: makeIt }, made };
  };
  let heldId: string;

  it("hands the article to the keys, and reports its words before writing", async () => {
    heldId = await articleSourceId(ARTICLE_URL);
    const { deps, made } = withLibrary(false);
    const words: number[] = [];

    await runArticleOverviewGeneration(async () => READ, deps, { onArticleRead: (article) => words.push(article.wordCount) });

    expect(words).toEqual([3200]);
    expect(made).toHaveLength(1);
    expect(made[0]).toHaveProperty("article.url", ARTICLE_URL);
    expect(made[0]).not.toHaveProperty("transcript");
  });

  it("reads the article at once but waits to write until told, as onboarding's does", async () => {
    heldId = await articleSourceId(ARTICLE_URL);
    const { deps, made } = withLibrary(false);
    let startWriting!: () => void;
    const answered = new Promise<void>((resolve) => (startWriting = resolve));
    let read = false;

    const run = runArticleOverviewGeneration(async () => READ, deps, {
      onArticleRead: () => (read = true),
      waitToWrite: () => answered,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(read).toBe(true);
    expect(made).toEqual([]);

    startWriting();
    await run;
    expect(made).toHaveLength(1);
  });

  it("makes nothing from a page that couldn't be read", async () => {
    const { deps, made } = withLibrary(false);

    const run = runArticleOverviewGeneration(async () => ({ status: "failed", reason: "paywalled", shownWords: 180 }), deps);

    await expect(run).rejects.toBeInstanceOf(ArticleReadError);
    expect(made).toEqual([]);
  });

  it("stops at an article already held under its canonical address", async () => {
    heldId = await articleSourceId(ARTICLE_URL);
    const { deps, made } = withLibrary(true);

    await expect(runArticleOverviewGeneration(async () => READ, deps)).rejects.toBeInstanceOf(ArticleAlreadyHeldError);
    expect(made).toEqual([]);
  });

  it("writes over what it holds when regenerating, which is the reader's deliberate act", async () => {
    heldId = await articleSourceId(ARTICLE_URL);
    const { deps, made } = withLibrary(true);

    await runArticleOverviewGeneration(async () => READ, deps, { overviewId: makeArticleOverview().id as OverviewId });

    expect(made).toHaveLength(1);
  });
});
