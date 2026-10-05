import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { OverviewId, TopicId, VideoId, type Novelty, type WatchAnswer } from "@overview/domain";
import { storedOverview, storedTopic } from "./storedRecords.testHelper.js";

const SAMPLES = new URL("../../../../samples/records/", import.meta.url);

interface SampleRecord {
  title: string;
  channel: string;
  topic: string;
  synopsis: string;
  claim: string;
  points: string[];
  verdict: string;
  reasoning: string;
  selling: string;
  sells: boolean;
  try: string;
  watch: string;
  watchFlag: string;
  tags: string[];
  source: string;
  saved: string;
  myNote: string;
}

const NOVELTY: Record<string, Novelty> = {
  NOVEL: "original",
  "SOLID BUT FAMILIAR": "common_knowledge",
  RECYCLED: "common_knowledge",
};
const WATCH: Record<string, WatchAnswer> = { Yes: "yes", No: "no" };
const ITEM_START = /^\s*(?:\d+\.|-)\s+/;

// The prototype wrote actions as a numbered list in some notes and a dashed one in others,
// with items wrapped over several lines and prose after them (CLAUDE.md, "samples/").
function actionItems(text: string): string[] {
  const items: string[] = [];
  let open: string | null = null;
  for (const line of text.split("\n")) {
    if (ITEM_START.test(line)) {
      if (open !== null) items.push(open);
      open = line.replace(ITEM_START, "").trim();
    } else if (line.trim() === "") {
      if (open !== null) items.push(open);
      open = null;
    } else if (open !== null) {
      open = `${open} ${line.trim()}`;
    }
  }
  if (open !== null) items.push(open);
  return items;
}

export interface SampleNote {
  file: string;
  topic: string;
  actionStyle: "numbered" | "dashed";
  overview: ReturnType<typeof storedOverview>;
}

export interface SampleLibrary {
  topics: Array<ReturnType<typeof storedTopic>>;
  notes: SampleNote[];
}

// The five real notes in samples/records, as the records this build stores: real content
// rather than invented fixtures, with the prototype's variance intact (CLAUDE.md).
export function sampleLibrary(): SampleLibrary {
  const files = readdirSync(SAMPLES).filter((file) => file.endsWith(".json")).sort();
  const samples = files.map((file) => ({ file, sample: JSON.parse(readFileSync(new URL(file, SAMPLES), "utf8")) as SampleRecord }));
  const topics = [...new Set(samples.map(({ sample }) => sample.topic))].map((name) => storedTopic({ name }));

  const notes = samples.map(({ file, sample }): SampleNote => {
    const url = new URL(sample.source);
    const topic = topics.find((candidate) => candidate.name === sample.topic)!;
    return {
      file,
      topic: sample.topic,
      actionStyle: /^\s*\d+\./.test(sample.try) ? "numbered" : "dashed",
      overview: storedOverview({
        id: OverviewId.parse(randomUUID()),
        video: {
          id: VideoId.parse(url.searchParams.get("v")),
          url: sample.source,
          title: sample.title,
          channel: sample.channel,
          description: null,
          durationMs: null,
          publishedAt: null,
          thumbnailUrl: null,
        },
        savedAt: `${sample.saved}T09:00:00.000Z`,
        captureReason: sample.myNote,
        inOneLine: sample.synopsis,
        coreClaim: sample.claim,
        thin: false,
        keyPoints: sample.points.map((text) => ({ text, range: null })),
        topicIds: [TopicId.parse(topic.id)],
        tags: sample.tags,
        verdict: { novelty: NOVELTY[sample.verdict]!, standsOut: null, dubious: false, dubiousClaims: [], reasoning: sample.reasoning, similarTo: [] },
        selling: sample.sells
          ? { type: "own_paid_product", detail: sample.selling, compromisesContent: false }
          : { type: "none", detail: "", compromisesContent: false },
        howToApply: { items: actionItems(sample.try).slice(0, 3) },
        watchAnyway: { answer: WATCH[sample.watchFlag]!, reason: sample.watch.replace(/^(Yes|No)[.,]\s*/, ""), range: null },
        chapters: null,
      }),
    };
  });
  return { topics, notes };
}
