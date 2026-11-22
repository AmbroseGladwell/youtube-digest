import type { ArticleLink } from "../useArticleLink.js";
import { episodeActionOf, type EpisodeAction } from "../../podcasts/util/episodeActionOf.js";
import type { PodcastLink } from "../usePodcastLink.js";

export interface PastedLinkState {
  // The episode's card or failure is what shows under the field.
  podcastShown: boolean;
  // Not known yet: a page that may be an episode is still being read as one.
  reading: boolean;
  // Generate is offered, though it may wait on `reading`.
  generateOffered: boolean;
  // For a found episode, what Create does once its words are checked for (design 305c).
  episodeAction: EpisodeAction | null;
}

export interface PastedPodcast {
  link: PodcastLink;
  platformLink: boolean;
}

// A Spotify or Apple link is only ever an episode. Any other page is one only once our server has
// found the episode there, and until it has, it may still be an article.
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
