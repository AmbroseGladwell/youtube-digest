import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OverviewId, TopicId, tagUsage } from "@overview/domain";
import type { GenerationInput } from "@overview/generation";

export type ReaderProfile = Pick<
  GenerationInput,
  "captureReason" | "readerContext" | "existingTopics" | "pastClaims" | "existingTags" | "tagAliases"
>;

interface SampleRecord {
  title: string;
  topic: string;
  claim: string;
  tags: string[];
}

const samplesDirectory = fileURLToPath(new URL("../../../samples/records/", import.meta.url));

export const SAMPLE_READER_CONTEXT =
  "A UK parent of a primary-school child, running a small software business, training for size at the gym, and saving towards financial independence.";

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function readerProfileOf(records: readonly SampleRecord[]): ReaderProfile {
  const topicNames = [...new Set(records.map((record) => capitalised(record.topic)))];
  return {
    captureReason: null,
    readerContext: SAMPLE_READER_CONTEXT,
    existingTopics: topicNames.map((name, index) => ({
      id: TopicId.parse(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
      name,
      description: null,
      createdAt: "2026-10-19T00:00:00.000Z",
    })),
    pastClaims: records.map((record, index) => ({
      overviewId: OverviewId.parse(`00000000-0000-4000-9000-${String(index).padStart(12, "0")}`),
      title: record.title,
      claim: record.claim,
    })),
    existingTags: tagUsage(records.map((record) => record.tags)),
    tagAliases: {},
  };
}

export async function loadSampleReader(): Promise<ReaderProfile> {
  const files = (await readdir(samplesDirectory)).filter((file) => file.endsWith(".json")).sort();
  const records = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(join(samplesDirectory, file), "utf-8")) as SampleRecord),
  );
  return readerProfileOf(records);
}
