import type { useArticleLink } from "../../useArticleLink.js";
import type { usePodcastLink } from "../../usePodcastLink.js";
import type { useTikTokLink } from "../../useTikTokLink.js";
import { TikTokLinkStatus } from "../TikTokLinkStatus/TikTokLinkStatus.js";
import { pastedLinkState } from "../../util/pastedLinkState.js";
import { ArticleLinkStatus } from "../ArticleLinkStatus/ArticleLinkStatus.js";
import { PodcastLinkStatus } from "../PodcastLinkStatus/PodcastLinkStatus.js";

export interface PastedLinkStatusProps {
  article: ReturnType<typeof useArticleLink>;
  podcast: ReturnType<typeof usePodcastLink>;
  tiktok?: ReturnType<typeof useTikTokLink> | undefined;
  url: string;
  onClear: () => void;
  onOpened?: (() => void) | undefined;
}

export const PastedLinkStatus = ({ article, podcast, tiktok, url, onClear, onOpened }: PastedLinkStatusProps) => {
  const opened = onOpened === undefined ? {} : { onOpened };
  const state = pastedLinkState(article.link, podcast, tiktok?.link);
  if (state.tiktokShown && tiktok !== undefined) {
    return <TikTokLinkStatus link={tiktok.link} onRetry={tiktok.retry} onClear={onClear} {...opened} />;
  }
  return state.podcastShown ? (
    <PodcastLinkStatus link={podcast.link} url={url} onRetry={podcast.retry} onClear={onClear} {...opened} />
  ) : (
    <ArticleLinkStatus link={article.link} url={url} place={article.place} onRetry={article.retry} onClear={onClear} {...opened} />
  );
};
