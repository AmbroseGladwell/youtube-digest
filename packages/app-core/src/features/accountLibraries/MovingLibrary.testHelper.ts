import {
  DEFAULT_OVERVIEW_STATE,
  TopicId,
  type Overview,
  type OverviewId,
  type OverviewState,
  type StoredTranscript,
  type Topic,
  type TranscriptStore,
  type VideoId,
} from "@overview/domain";
import type { MovingStores } from "./moveLibraryInto.js";

// The parts of one library the move reads and writes, held in memory.
export class MovingLibrary implements MovingStores {
  readonly #overviews = new Map<string, Overview>();
  readonly #states = new Map<string, OverviewState>();
  readonly #topics = new Map<string, Topic>();
  readonly #transcripts = new Map<string, StoredTranscript>();

  seedOverview = (overview: Overview): void => void this.#overviews.set(overview.id, overview);
  seedState = (state: OverviewState): void => void this.#states.set(state.overviewId, state);
  seedTopic = (topic: Topic): void => void this.#topics.set(topic.id, topic);
  seedTranscript = (transcript: StoredTranscript): void => void this.#transcripts.set(transcript.videoId, transcript);

  overviewStore: MovingStores["overviewStore"] = {
    listOverviews: async () => [...this.#overviews.values()],
    listUnreadable: async () => [],
    listTopics: async () => [...this.#topics.values()],
    createTopic: async ({ name }) => {
      const topic: Topic = {
        id: TopicId.parse(crypto.randomUUID()),
        name,
        description: null,
        createdAt: new Date().toISOString(),
      };
      this.#topics.set(topic.id, topic);
      return topic;
    },
    saveOverview: async (overview) => void this.#overviews.set(overview.id, overview),
    getOverviewState: async (overviewId: OverviewId) =>
      this.#states.get(overviewId) ?? { overviewId, ...DEFAULT_OVERVIEW_STATE },
    setOverviewState: async (overviewId, patch) =>
      void this.#states.set(overviewId, {
        ...(this.#states.get(overviewId) ?? { overviewId, ...DEFAULT_OVERVIEW_STATE }),
        ...patch,
      }),
    deleteOverview: async (id) => {
      this.#overviews.delete(id);
      this.#states.delete(id);
    },
  };

  transcriptStore: TranscriptStore = {
    getTranscript: async (videoId: VideoId) => this.#transcripts.get(videoId) ?? null,
    saveTranscript: async (transcript) => void this.#transcripts.set(transcript.videoId, transcript),
    deleteTranscript: async (videoId) => void this.#transcripts.delete(videoId),
  };
}
