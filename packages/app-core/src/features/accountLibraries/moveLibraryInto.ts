import {
  DEFAULT_OVERVIEW_STATE,
  sameTopicName,
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

// The no-account library into the account's, one overview per video: where the account
// already has an overview of a video, its copy is kept and this one is let go. Each overview
// is written into the account before it leaves here, so a move that stops halfway is
// finished by running it again: what already arrived now counts as the account's, and only
// goes from here (docs/features/account-libraries.md, "The move on sign-in").
export async function moveLibraryInto(from: MovingStores, into: MovingStores): Promise<LibraryMove & { videoIds: VideoId[] }> {
  const [leaving, held, heldUnreadable, leavingTopics, accountTopics] = await Promise.all([
    from.overviewStore.listOverviews(),
    into.overviewStore.listOverviews(),
    into.overviewStore.listUnreadable(),
    from.overviewStore.listTopics(),
    into.overviewStore.listTopics(),
  ]);

  const heldVideos = new Set<string>([
    ...held.flatMap(({ video }) => (video.id === null ? [] : [video.id])),
    ...heldUnreadable.flatMap(({ salvaged }) => (salvaged?.video?.id == null ? [] : [salvaged.video.id])),
  ]);
  const leavingTopicNames = new Map(leavingTopics.map((topic) => [topic.id, topic.name]));
  const knownTopics: Topic[] = [...accountTopics];

  const accountTopicFor = async (topicId: TopicId): Promise<TopicId | null> => {
    const name = leavingTopicNames.get(topicId);
    if (name === undefined) return null;
    const existing = knownTopics.find((topic) => sameTopicName(topic.name, name));
    if (existing !== undefined) return existing.id;
    const created = await into.overviewStore.createTopic({ name });
    knownTopics.push(created);
    return created.id;
  };

  const add = async (overview: Overview): Promise<void> => {
    const topicIds: TopicId[] = [];
    for (const topicId of overview.topicIds) {
      const mapped = await accountTopicFor(topicId);
      if (mapped !== null && !topicIds.includes(mapped)) topicIds.push(mapped);
    }
    const transcript = overview.video.id === null ? null : await from.transcriptStore.getTranscript(overview.video.id);
    if (transcript !== null) await into.transcriptStore.saveTranscript(transcript);
    await into.overviewStore.saveOverview({ ...overview, topicIds });

    const { read, favourite, userTags } = await from.overviewStore.getOverviewState(overview.id);
    const patch = {
      ...(read !== DEFAULT_OVERVIEW_STATE.read ? { read } : {}),
      ...(favourite !== DEFAULT_OVERVIEW_STATE.favourite ? { favourite } : {}),
      ...(userTags.length > 0 ? { userTags } : {}),
    };
    if (Object.keys(patch).length > 0) await into.overviewStore.setOverviewState(overview.id, patch);
  };

  let moved = 0;
  let alreadyThere = 0;
  const videoIds: VideoId[] = [];
  for (const overview of leaving) {
    const videoId = overview.video.id;
    if (videoId !== null && heldVideos.has(videoId)) {
      alreadyThere += 1;
    } else {
      await add(overview);
      moved += 1;
      if (videoId !== null) {
        heldVideos.add(videoId);
        videoIds.push(videoId);
      }
    }
    await from.overviewStore.deleteOverview(overview.id);
    if (videoId !== null) await from.transcriptStore.deleteTranscript(videoId);
  }
  return { moved, alreadyThere, videoIds };
}
