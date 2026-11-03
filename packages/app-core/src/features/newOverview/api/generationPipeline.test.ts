import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  articleSourceId,
  type ArticleRead,
  type OverviewId,
  type OverviewStore,
  type Settings,
  type StoredTranscript,
  type Topic,
  type TranscriptStore,
  type AboutYou,
  type LearnedItems,
} from "@overview/domain";
import type { GenerationInput } from "@overview/generation";
import { makeArticleOverview, makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import { ArticleAlreadyHeldError } from "./ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./ArticleReadError.js";
import { runArticleOverviewGeneration, runOverviewGeneration, type GenerationPipelineDeps } from "./generationPipeline.js";

const VIDEO = makeOverview().source;

const makeDeps = () => {
  const topics: Topic[] = [];
  let settings: Settings = DEFAULT_SETTINGS;
  const inputs: GenerationInput[] = [];
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
      getTranscript: async () => stored,
      saveTranscript: async () => {},
      deleteTranscript: async () => {},
    } satisfies TranscriptStore,
    overviewStore: {
      listTopics: async () => [...topics],
      listClaims: async () => [],
      listOverviews: async () => [],
      saveOverview: async () => {},
    } as unknown as OverviewStore,
    settingsStore: { get: async () => settings },
    makeOverview: async (input, { id }) => {
      inputs.push(input as GenerationInput);
      return makeOverview({ id });
    },
  };
  return {
    deps,
    inputs,
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

  it("writes for what was learned as well as the sentence, and leaves a removed item out", async () => {
    const { deps, inputs, setAboutYou, setLearned } = makeDeps();
    const learnedItem = { source: "From 2 overviews", learnedAt: "2026-11-01T10:00:00.000Z", noticedAt: null };
    setAboutYou({ who: ["nurse"], time: [], focus: [] });
    setLearned({
      "building an app": { ...learnedItem, text: "building an app", removedAt: null },
      "saving for a home": { ...learnedItem, text: "saving for a home", removedAt: "2026-11-02T10:00:00.000Z" },
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
  },
};

describe("runArticleOverviewGeneration", () => {
  const withLibrary = (held: boolean) => {
    const made: unknown[] = [];
    const overview = makeArticleOverview();
    const store = {
      listTopics: async () => [],
      listClaims: async () => [],
      listUnreadable: async () => [],
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
