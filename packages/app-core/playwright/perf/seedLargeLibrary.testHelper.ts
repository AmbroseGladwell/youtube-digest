import { CURRENT_SCHEMA_VERSIONS, type RecordChange } from "@overview/domain";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { makeOverview, makeOverviewState } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../src/features/overviews/types/TopicFactory.testHelper.js";

const WORDS = "light sleep coffee training memory habit focus protein walking stress reading breathing".split(" ");
const AFTER_OVERVIEWS = 1_000_000;

// Every second overview is read, so the default view (unread) shows half. "feed" sends states and topics through sync too.
export const seedLargeLibrary = (
  backend: BackendSimulator,
  size: number,
  { statesFrom = "device" }: { statesFrom?: "device" | "feed" } = {},
) => {
  const later: RecordChange[] = [];
  const seed = (kind: "topic" | "overviewState", id: string, body: Record<string, unknown>) =>
    later.push({
      kind,
      id,
      schemaVersion: CURRENT_SCHEMA_VERSIONS[kind],
      rev: 1,
      seq: AFTER_OVERVIEWS + later.length,
      updatedAt: new Date().toISOString(),
      deleted: false,
      body,
    });
  const topics = ["Sleep", "Training", "Food", "Work"].map((name) => makeTopic({ name }));
  for (const topic of topics) {
    if (statesFrom === "feed") {
      seed("topic", topic.id, topic);
    } else {
      backend.overviews.seedTopic(topic);
    }
  }
  for (let index = 0; index < size; index += 1) {
    const words = Array.from({ length: 3 + ((index * 7) % 11) }, (_, at) => WORDS[(index + at * 5) % WORDS.length]).join(" ");
    const overview = makeOverview({
      savedAt: new Date(Date.UTC(2025, 0, 1) + index * 3_600_000).toISOString(),
      topicIds: [topics[index % topics.length]!.id],
    });
    overview.source.title = `${index} ${words}`;
    backend.overviews.seedSynced(overview);
    if (index % 2 === 0) {
      const state = makeOverviewState(overview.id, { read: true });
      if (statesFrom === "feed") {
        seed("overviewState", overview.id, state);
      } else {
        backend.overviews.seedState(state);
      }
    }
  }
  for (const change of later) {
    backend.sync.seedChange(change);
  }
};
