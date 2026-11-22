import {
  DEFAULT_OVERVIEW_STATE,
  sameTopicName,
  sourceKey,
  type Overview,
  type Topic,
  type OverviewStore,
  type TopicId,
  type TranscriptStore,
  type VideoId,
} from "@overview/domain";
import type { LibraryMove } from "./types/LibraryMove.js";

export interface MovingStores {
  overviewStore: Pick<
    OverviewStore,
    | "listOverviews"
    | "listUnreadable"
    | "listTopics"
    | "createTopic"
    | "saveOverview"
    | "getOverviewState"
    | "setOverviewState"
    | "deleteOverview"
  >;
  transcriptStore: TranscriptStore;
}

// Rerunning finishes a stopped move: docs/features/account-libraries.md, "The move on sign-in".
export const moveLibraryInto = async (from: MovingStores, into: MovingStores): Promise<LibraryMove & { sourceKeys: VideoId[] }> => {
  const [leaving, held, heldUnreadable, leavingTopics, accountTopics] = await Promise.all([
    from.overviewStore.listOverviews(),
    into.overviewStore.listOverviews(),
    into.overviewStore.listUnreadable(),
    from.overviewStore.listTopics(),
    into.overviewStore.listTopics(),
  ]);

  const heldVideos = new Set<string>([
    ...held.flatMap(({ source }) => sourceKey(source) ?? []),
    ...heldUnreadable.flatMap(({ salvaged }) => (salvaged?.source == null ? [] : (sourceKey(salvaged.source) ?? []))),
  ]);
  const leavingTopicNames = new Map(leavingTopics.map((topic) => [topic.id, topic.name]));
  const knownTopics: Topic[] = [...accountTopics];

  const accountTopicFor = async (topicId: TopicId): Promise<TopicId | null> => {
    const name = leavingTopicNames.get(topicId);
    if (name === undefined) {
      return null;
    }
    const existing = knownTopics.find((topic) => sameTopicName(topic.name, name));
    if (existing !== undefined) {
      return existing.id;
    }
    const created = await into.overviewStore.createTopic({ name });
    knownTopics.push(created);
    return created.id;
  };

  const add = async (overview: Overview): Promise<void> => {
    const topicIds: TopicId[] = [];
    for (const topicId of overview.topicIds) {
      const mapped = await accountTopicFor(topicId);
      if (mapped !== null && !topicIds.includes(mapped)) {
        topicIds.push(mapped);
      }
    }
    const key = sourceKey(overview.source);
    const transcript = key === null ? null : await from.transcriptStore.getTranscript(key);
    if (transcript !== null) {
      await into.transcriptStore.saveTranscript(transcript);
    }
    await into.overviewStore.saveOverview({ ...overview, topicIds });

    const { read, favourite, userTags, asked } = await from.overviewStore.getOverviewState(overview.id);
    const patch = {
      ...(read !== DEFAULT_OVERVIEW_STATE.read ? { read } : {}),
      ...(favourite !== DEFAULT_OVERVIEW_STATE.favourite ? { favourite } : {}),
      ...(userTags.length > 0 ? { userTags } : {}),
      ...(asked.length > 0 ? { asked } : {}),
    };
    if (Object.keys(patch).length > 0) {
      await into.overviewStore.setOverviewState(overview.id, patch);
    }
  };

  let moved = 0;
  let alreadyThere = 0;
  const sourceKeys: VideoId[] = [];
  for (const overview of leaving) {
    const key = sourceKey(overview.source);
    if (key !== null && heldVideos.has(key)) {
      alreadyThere += 1;
    } else {
      await add(overview);
      moved += 1;
      if (key !== null) {
        heldVideos.add(key);
        sourceKeys.push(key);
      }
    }
    await from.overviewStore.deleteOverview(overview.id);
    if (key !== null) {
      await from.transcriptStore.deleteTranscript(key);
    }
  }
  return { moved, alreadyThere, sourceKeys };
};
