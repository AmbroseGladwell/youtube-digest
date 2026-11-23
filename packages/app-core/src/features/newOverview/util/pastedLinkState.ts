import type { ArticleLink } from "../useArticleLink.js";
import { episodeActionOf, type EpisodeAction } from "../../podcasts/util/episodeActionOf.js";
import type { PodcastLink } from "../usePodcastLink.js";
import type { TikTokLink } from "../useTikTokLink.js";

export interface PastedLinkState {
  podcastShown: boolean;
  tiktokShown: boolean;
  // A page that may be an episode is still being read as one.
  reading: boolean;
  // Offered even while it waits on `reading`.
  generateOffered: boolean;
  episodeAction: EpisodeAction | null;
}

export interface PastedPodcast {
  link: PodcastLink;
  platformLink: boolean;
}

// A TikTok link is never an article's: it is read as a TikTok, or refused as one (130a, 130l–130n).
const tiktokState = (tiktok: TikTokLink): PastedLinkState => ({
  podcastShown: false,
  tiktokShown: true,
  reading: tiktok.status === "reading",
  generateOffered: (tiktok.status === "found" && tiktok.stop === null) || tiktok.status === "reading",
  episodeAction: null,
});

// A non-platform page is an episode only once our server has found one there.
export const pastedLinkState = (article: ArticleLink, podcast: PastedPodcast, tiktok: TikTokLink = { status: "none" }): PastedLinkState => {
  if (tiktok.status !== "none") {
    return tiktokState(tiktok);
  }
  const podcastShown = podcast.platformLink
    ? podcast.link.status !== "none"
    : podcast.link.status === "found" || podcast.link.status === "held";
  if (podcastShown) {
    const episodeAction = podcast.link.status === "found" ? episodeActionOf(podcast.link.words) : null;
    return {
      podcastShown,
      tiktokShown: false,
      reading: podcast.link.status === "reading" || episodeAction?.kind === "waiting",
      generateOffered: (podcast.link.status === "found" && episodeAction?.kind !== "stop") || podcast.link.status === "reading",
      episodeAction,
    };
  }
  return {
    podcastShown,
    tiktokShown: false,
    reading: podcast.link.status === "reading" || article.status === "reading",
    generateOffered: article.status !== "held" && article.status !== "failed",
    episodeAction: null,
  };
};
