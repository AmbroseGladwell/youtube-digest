import { useCallback } from "react";
import { createFetchArticleApi, createFetchPodcastApi } from "@overview/sync";
import type { Overview, QueuedCapture } from "@overview/domain";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import type { RunOverviewGenerationOptions } from "../newOverview/api/generationPipeline.js";
import { useRunArticleGeneration, useRunOverviewGeneration, useRunPodcastGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { EpisodeNeedsTranscribingError } from "../podcasts/api/EpisodeNeedsTranscribingError.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { queuedKindOf } from "./util/queuedKindOf.js";

export type QueuedMaker = (capture: QueuedCapture, options: RunOverviewGenerationOptions) => Promise<Overview>;

const originOptions = ({ fromPlaylist, fromFeed }: QueuedCapture): Partial<RunOverviewGenerationOptions> => {
  if (fromPlaylist !== null) {
    return { fromPlaylist };
  }
  return fromFeed == null ? {} : { fromFeed };
};

// Each kind made its own way; transcribing only for one the reader chose (docs/features/followed-feeds.md, "Making an entry").
export const useQueuedMaker = (apiKeys: ApiKeys): QueuedMaker => {
  const generate = useRunOverviewGeneration(apiKeys);
  const runPodcast = useRunPodcastGeneration(apiKeys);
  const runArticle = useRunArticleGeneration(apiKeys);
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

  return useCallback(
    async (capture, options) => {
      const made = { ...options, ...originOptions(capture) };
      const server = () => {
        if (knownApiUrl === null) {
          throw new Error("This is read through our server, and there isn't one here");
        }
        return { baseUrl: knownApiUrl, token: connection.token };
      };
      switch (queuedKindOf(capture)) {
        case "video":
          return generate(capture.url, made);
        case "article":
          return runArticle(() => createFetchArticleApi(server()).read(capture.url), made);
        case "episode": {
          const { feedUrl, guid } = capture.source as Extract<QueuedCapture["source"], { kind: "podcast" }>;
          const read = await createFetchPodcastApi(server()).readInFeed({ feedUrl, guid });
          if (read.status !== "read") {
            throw new Error(`The episode couldn't be read: ${read.reason}`);
          }
          const request = { episode: read.episode, sharedFrom: capture.url };
          try {
            return await runPodcast(request, made);
          } catch (error) {
            if (error instanceof EpisodeNeedsTranscribingError && capture.chosenAt !== null) {
              return runPodcast({ ...request, transcribe: "chosen" }, made);
            }
            throw error;
          }
        }
      }
    },
    [generate, runPodcast, runArticle, knownApiUrl, connection.token],
  );
};
