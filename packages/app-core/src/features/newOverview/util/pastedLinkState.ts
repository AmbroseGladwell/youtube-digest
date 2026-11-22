import type { ArticleLink } from "../useArticleLink.js";
import { episodeActionOf, type EpisodeAction } from "../../podcasts/util/episodeActionOf.js";
import type { PodcastLink } from "../usePodcastLink.js";

export interface PastedLinkState {
  podcastShown: boolean;
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

// A non-platform page is an episode only once our server has found one there.
export const pastedLinkState = (article: ArticleLink, podcast: PastedPodcast): PastedLinkState => {
  const podcastShown = podcast.platformLink
    ? podcast.link.status !== "none"
    : podcast.link.status === "found" || podcast.link.status === "held";
  if (podcastShown) {
    const episodeAction = podcast.link.status === "found" ? episodeActionOf(podcast.link.words) : null;
    return {
      podcastShown,
      reading: podcast.link.status === "reading" || episodeAction?.kind === "waiting",
      generateOffered: (podcast.link.status === "found" && episodeAction?.kind !== "stop") || podcast.link.status === "reading",
      episodeAction,
    };
  }
  return {
    podcastShown,
    reading: podcast.link.status === "reading" || article.status === "reading",
    generateOffered: article.status !== "held" && article.status !== "failed",
    episodeAction: null,
  };
};
