import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  type OverviewStore,
  type Settings,
  type StoredTranscript,
  type Topic,
  type TranscriptStore,
} from "@overview/domain";
import type { GenerationInput } from "@overview/generation";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import { runOverviewGeneration, type GenerationPipelineDeps } from "./generationPipeline.js";

const VIDEO = makeOverview().video;

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
      inputs.push(input);
      return makeOverview({ id });
    },
  };
  return {
    deps,
    inputs,
    addTopic: (topic: Topic) => topics.push(topic),
    setReaderContext: (readerContext: string) => (settings = { ...settings, readerContext }),
  };
};

describe("runOverviewGeneration", () => {
  it("waits to write until told, and writes with the topics and reader context chosen meanwhile", async () => {
    const { deps, inputs, addTopic, setReaderContext } = makeDeps();
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
    setReaderContext("Works in healthcare, learning about cooking.");
    startWriting();
    await run;

    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.existingTopics).toEqual([food]);
    expect(inputs[0]!.readerContext).toBe("Works in healthcare, learning about cooking.");
  });
});
