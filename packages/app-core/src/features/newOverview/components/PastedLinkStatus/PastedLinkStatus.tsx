import type { useArticleLink } from "../../useArticleLink.js";
import type { usePodcastLink } from "../../usePodcastLink.js";
import { pastedLinkState } from "../../util/pastedLinkState.js";
import { ArticleLinkStatus } from "../ArticleLinkStatus/ArticleLinkStatus.js";
import { PodcastLinkStatus } from "../PodcastLinkStatus/PodcastLinkStatus.js";

export interface PastedLinkStatusProps {
  article: ReturnType<typeof useArticleLink>;
  podcast: ReturnType<typeof usePodcastLink>;
  url: string;
  onClear: () => void;
  onOpened?: (() => void) | undefined;
}

// Under every paste field, what the link turned out to be: an episode or an article.
export function PastedLinkStatus({ article, podcast, url, onClear, onOpened }: PastedLinkStatusProps) {
  const opened = onOpened === undefined ? {} : { onOpened };
  return pastedLinkState(article.link, podcast).podcastShown ? (
    <PodcastLinkStatus link={podcast.link} url={url} onRetry={podcast.retry} onClear={onClear} {...opened} />
  ) : (
    <ArticleLinkStatus link={article.link} url={url} place={article.place} onRetry={article.retry} onClear={onClear} {...opened} />
  );
}
