import { useState } from "react";
import { domainOf, podcastPlatform, recipeMinutes, type PodcastEpisode } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import { TranscriptionNotice } from "../../../podcasts/components/TranscriptionNotice/TranscriptionNotice.js";
import { episodeActionOf } from "../../../podcasts/util/episodeActionOf.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import type { EpisodeWords, PodcastLink } from "../../usePodcastLink.js";
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

// "1 hr 56 min · 10 Nov 2026", or the date alone when the feed gives no length.
export const episodeFacts = (episode: Pick<PodcastEpisode, "durationSeconds" | "publishedAt">): string =>
  [
    episode.durationSeconds === null ? null : recipeMinutes(Math.round(episode.durationSeconds / 60)),
    episode.publishedAt === null ? null : formatPublishedDate(episode.publishedAt),
  ]
    .filter(Boolean)
    .join(" · ");

export const PodcastLinkStatus = ({ link, url, onRetry, onClear, onOpened }: PodcastLinkStatusProps) => {
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
      return (
        <>
          <EpisodeCard episode={link.episode} from={FROM[podcastPlatform(url)]} words={link.words} />
          <EpisodeWordsNote words={link.words} episodeSeconds={link.episode.durationSeconds} onFollowed={onOpened} />
        </>
      );
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
};

export interface EpisodeWordsNoteProps {
  words: EpisodeWords;
  episodeSeconds: number | null;
  onFollowed?: (() => void) | undefined;
}

export const EpisodeWordsNote = ({ words, episodeSeconds, onFollowed }: EpisodeWordsNoteProps) => {
  const usage = useOverviewUsageQuery().data ?? null;
  const action = episodeActionOf(words);
  switch (action.kind) {
    case "transcribe":
      return (
        <p className={styles.line} data-testid={podcastLinkStatusTestIds.uses}>
          {transcriptionCopy.uses(episodeSeconds, action.offer.usage)}
        </p>
      );
    case "free":
      return (
        <p className={styles.line} data-testid={podcastLinkStatusTestIds.free}>
          {transcriptionCopy.free(action.offer.why)}
        </p>
      );
    case "stop": {
      const stop = transcriptionCopy.stop(action.offer, usage?.plan ?? "free", usage?.resetsOn ?? null);
      return <TranscriptionNotice notice={stop} route={stop.route} onFollowed={onFollowed} />;
    }
    default:
      return null;
  }
};

const wordsLine = (words: EpisodeWords, episodeSeconds: number | null): string | null => {
  if (words.state === "checking") {
    return "Checking for a transcript…";
  }
  const action = episodeActionOf(words);
  return action.kind === "transcribe" ? transcriptionCopy.needs(episodeSeconds) : null;
};

interface EpisodeCardProps {
  episode: PodcastEpisode;
  from: string;
  words: EpisodeWords;
}

const EpisodeCard = ({ episode, from, words }: EpisodeCardProps) => {
  const line = wordsLine(words, episode.durationSeconds);
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
        <span
          className={words.state === "checking" ? styles.checking : styles.needs}
          role="status"
          data-testid={podcastLinkStatusTestIds.words}
        >
          {line}
        </span>
      </span>
    </div>
  );
};

const hostOf = (url: string): string => {
  try {
    return domainOf(url);
  } catch {
    return url;
  }
};
