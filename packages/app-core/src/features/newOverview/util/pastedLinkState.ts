import type { ArticleLink } from "../useArticleLink.js";
import type { PodcastLink } from "../usePodcastLink.js";

export interface PastedLinkState {
  // The episode's card or failure is what shows under the field.
  podcastShown: boolean;
  // Not known yet: a page that may be an episode is still being read as one.
  reading: boolean;
  // Generate is offered, though it may wait on `reading`.
  generateOffered: boolean;
}

// A Spotify or Apple link is only ever an episode. Any other page is one only once our server has
// found the episode there, and until it has, it may still be an article.
export function pastedLinkState(article: ArticleLink, podcast: { link: PodcastLink; platformLink: boolean }): PastedLinkState {
  const podcastShown = podcast.platformLink
    ? podcast.link.status !== "none"
    : podcast.link.status === "found" || podcast.link.status === "held";
  if (podcastShown) {
    return {
      podcastShown,
      reading: podcast.link.status === "reading",
      generateOffered: podcast.link.status === "found" || podcast.link.status === "reading",
    };
  }
  return {
    podcastShown,
    reading: podcast.link.status === "reading" || article.status === "reading",
    generateOffered: article.status !== "held" && article.status !== "failed",
  };
}
