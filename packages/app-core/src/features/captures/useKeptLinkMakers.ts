import { useCallback } from "react";
import { createFetchPodcastApi, createFetchTikTokApi } from "@overview/sync";
import type { KeptCapture, Overview } from "@overview/domain";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useArticlePages } from "../../app/ArticlePagesContext.js";
import { useTikTokPages } from "../../app/TikTokPagesContext.js";
import type { RunOverviewGenerationOptions } from "../newOverview/api/generationPipeline.js";
import {
  useRunArticleGeneration,
  useRunOverviewGeneration,
  useRunPodcastGeneration,
  useRunTikTokGeneration,
} from "../newOverview/useRunOverviewGeneration.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { readTikTokLink } from "../tiktok/api/readTikTokLink.js";
import { keptLinkKind } from "./util/keptLinkKind.js";

export interface KeptLinkMakers {
  make: (link: KeptCapture, options: RunOverviewGenerationOptions) => Promise<Overview>;
  // Only the extension reads TikToks and the pages our server can't, and only with the reader's leave.
  hasAccess: (link: KeptCapture) => Promise<boolean>;
  // Must be called inside the click, or Chrome refuses it.
  askAccess: (link: KeptCapture) => Promise<boolean>;
}

const UNREADABLE = "Only the extension reads this, and it isn't here";

// Each kind of kept link made its own way: docs/features/kept-links.md, "Kept links".
export const useKeptLinkMakers = (apiKeys: ApiKeys): KeptLinkMakers => {
  const generate = useRunOverviewGeneration(apiKeys);
  const runPodcast = useRunPodcastGeneration(apiKeys);
  const runArticle = useRunArticleGeneration(apiKeys);
  const runTikTok = useRunTikTokGeneration(apiKeys);
  const articlePages = useArticlePages();
  const tiktokPages = useTikTokPages();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

  const serverApi = useCallback(() => {
    if (knownApiUrl === null) {
      throw new Error("This is read through our server, and there isn't one here");
    }
    return { baseUrl: knownApiUrl, token: connection.token };
  }, [knownApiUrl, connection.token]);

  const make = useCallback(
    async (link: KeptCapture, options: RunOverviewGenerationOptions): Promise<Overview> => {
      switch (keptLinkKind(link)) {
        case "youtube":
          return generate(link.url, options);
        case "podcast": {
          const read = await createFetchPodcastApi(serverApi()).read(link.url);
          if (read.status !== "read") {
            throw new Error(`The episode couldn't be read: ${read.reason}`);
          }
          return runPodcast({ episode: read.episode, sharedFrom: link.url, transcribe: "chosen" }, options);
        }
        case "article":
          if (articlePages === null) {
            throw new Error(UNREADABLE);
          }
          return runArticle(() => articlePages.readAt(link.url), options);
        case "tiktok": {
          const read = await readTikTokLink(link.url, { own: tiktokPages, server: createFetchTikTokApi(serverApi()).read });
          if (read.status === "failed") {
            throw new Error(`The TikTok couldn't be read: ${read.reason}`);
          }
          return runTikTok({ video: read.video, words: read.words }, options);
        }
      }
    },
    [generate, runPodcast, runArticle, runTikTok, articlePages, tiktokPages, serverApi],
  );

  const hasAccess = useCallback(
    async (link: KeptCapture): Promise<boolean> => {
      switch (keptLinkKind(link)) {
        case "article":
          return articlePages === null ? false : articlePages.hasAccess(link.url);
        case "tiktok":
          return tiktokPages === null ? false : tiktokPages.hasAccess();
        default:
          return true;
      }
    },
    [articlePages, tiktokPages],
  );

  const askAccess = useCallback(
    (link: KeptCapture): Promise<boolean> => {
      if (keptLinkKind(link) === "article") {
        return articlePages?.requestAccess(link.url) ?? Promise.resolve(false);
      }
      return tiktokPages?.requestAccess() ?? Promise.resolve(false);
    },
    [articlePages, tiktokPages],
  );

  return { make, hasAccess, askAccess };
};
