import { useState } from "react";
import { domainOf, podcastPlatform, recipeMinutes, type PodcastEpisode } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import type { PodcastLink } from "../../usePodcastLink.js";
import { podcastLinkFailureCopy } from "../../util/podcastLinkFailureCopy.js";
import styles from "./PodcastLinkStatus.module.scss";
import { podcastLinkStatusTestIds } from "./PodcastLinkStatusTestIds.js";

export interface PodcastLinkStatusProps {
  link: PodcastLink;
  url: string;
  onRetry: () => void;
  onClear: () => void;
  onOpened?: () => void;
}

const FROM: Record<ReturnType<typeof podcastPlatform>, string> = { spotify: "Spotify", apple: "Apple", page: "the show’s page" };

const madeOn = (savedAt: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

// "1 hr 56 min · 10 Nov 2026": the feed's own facts, the date alone when it gives no length.
export const episodeFacts = (episode: Pick<PodcastEpisode, "durationSeconds" | "publishedAt">): string =>
  [
    episode.durationSeconds === null ? null : recipeMinutes(Math.round(episode.durationSeconds / 60)),
    episode.publishedAt === null ? null : formatPublishedDate(episode.publishedAt),
  ]
    .filter(Boolean)
    .join(" · ");

// Designs 106a–106f: under the field, the episode our server found, or why it can't be used.
export function PodcastLinkStatus({ link, url, onRetry, onClear, onOpened }: PodcastLinkStatusProps) {
  switch (link.status) {
    case "none":
      return null;
    case "reading":
      return (
        <div className={styles.card} data-testid={podcastLinkStatusTestIds.reading}>
          <span className={styles.blank} aria-hidden="true" />
          <span className={styles.words}>
            <span className={styles.host}>{hostOf(url)}</span>
            <span className={styles.finding} role="status">
              Finding the episode…
            </span>
          </span>
        </div>
      );
    case "found":
      return <EpisodeCard episode={link.episode} from={FROM[podcastPlatform(url)]} />;
    case "held":
      return (
        <div className={styles.held} data-testid={podcastLinkStatusTestIds.held}>
          <span>
            You already have this episode.
            {link.savedAt !== null && ` You made an overview of it on ${madeOn(link.savedAt)}.`}
          </span>
          <PageLink
            className={styles.open}
            to={Routes.overview(link.overviewId)}
            onClick={onOpened}
            data-testid={podcastLinkStatusTestIds.openHeld}
          >
            Open your overview
          </PageLink>
        </div>
      );
    case "unreachable":
      return (
        <p className={styles.line} role="alert" data-testid={podcastLinkStatusTestIds.unreachable}>
          We couldn’t check that link just now.{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        </p>
      );
    case "failed": {
      const copy = podcastLinkFailureCopy(link.reason, link.showName);
      return <ArticleFailureNotice copy={copy} onWay={copy.way === "tryAgain" ? onRetry : onClear} />;
    }
  }
}

function EpisodeCard({ episode, from }: { episode: PodcastEpisode; from: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.card} data-testid={podcastLinkStatusTestIds.found}>
      {episode.imageUrl === null || failed ? (
        <span className={styles.tile} aria-hidden="true">
          {episode.showName}
        </span>
      ) : (
        <img className={styles.art} src={episode.imageUrl} alt="" onError={() => setFailed(true)} />
      )}
      <span className={styles.words}>
        <span className={styles.kicker} data-testid={podcastLinkStatusTestIds.kicker}>
          {episode.showName} · Podcast · from {from}
        </span>
        <span className={styles.title} data-testid={podcastLinkStatusTestIds.title}>
          {episode.title}
        </span>
        <span className={styles.facts} data-testid={podcastLinkStatusTestIds.facts}>
          {episodeFacts(episode)}
        </span>
      </span>
    </div>
  );
}

const hostOf = (url: string): string => {
  try {
    return domainOf(url);
  } catch {
    return url;
  }
};
