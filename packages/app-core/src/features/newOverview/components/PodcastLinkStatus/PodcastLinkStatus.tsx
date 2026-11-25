import { useState } from "react";
import { domainOf, podcastPlatform, recipeMinutes, type PodcastEpisode, type TranscribedSource } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import { TranscriptionNotice } from "../../../podcasts/components/TranscriptionNotice/TranscriptionNotice.js";
import { LimitInPlace, type LimitWaitAction } from "../../../plus/components/LimitInPlace/LimitInPlace.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { usePlanPrompt } from "../../../plus/usePlanPrompt.js";
import { limitCopy, type LimitCopy } from "../../../plus/util/limitCopy.js";
import { episodeActionOf } from "../../../podcasts/util/episodeActionOf.js";
import { TRANSCRIBED_NOUN, transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { useNewOverviewRunController } from "../../NewOverviewRunContext.js";
import { resetDate } from "../../util/usageLine.js";
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
  const { keepForReset } = useNewOverviewRunController();
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
          <EpisodeWordsNote
            words={link.words}
            episodeSeconds={link.episode.durationSeconds}
            onFollowed={onOpened}
            onKeep={() => keepForReset({ episode: link.episode, sharedFrom: url })}
          />
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
  source?: TranscribedSource;
  // Out of transcribing, the link can wait for the month to turn (docs/features/kept-links.md, "Saving at the limit").
  onKeep?: (() => Promise<void>) | undefined;
}

export const EpisodeWordsNote = ({ words, episodeSeconds, onFollowed, source = "podcast", onKeep }: EpisodeWordsNoteProps) => {
  const usage = useOverviewUsageQuery().data ?? null;
  const action = episodeActionOf(words);
  const [kept, setKept] = useState(false);
  const backOn = usage === null ? "next month" : `on ${resetDate(usage.resetsOn)}`;
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
          {transcriptionCopy.free(action.offer.why, source)}
        </p>
      );
    case "stop": {
      if (kept) {
        return (
          <p className={styles.kept} role="status" data-testid={podcastLinkStatusTestIds.keptForReset}>
            <b>Kept. It’s transcribed and made {backOn}, when your hours are back.</b>
            <span>It waits in your queue. Nothing else to do.</span>
          </p>
        );
      }
      if (action.offer.status === "not-enough" && usage !== null) {
        const { usage: spent } = action.offer;
        return (
          <HoursLimit
            copy={limitCopy.hours({
              plan: usage.plan,
              resetsOn: usage.resetsOn,
              usedSeconds: spent.usedSeconds,
              limitSeconds: spent.limitSeconds,
              episodeSeconds: action.offer.episodeSeconds ?? episodeSeconds,
              noun: TRANSCRIBED_NOUN[source],
            })}
            keep={
              onKeep === undefined
                ? null
                : { label: `Keep it until ${resetDate(usage.resetsOn)}`, onPress: () => void onKeep().then(() => setKept(true)) }
            }
          />
        );
      }
      const stop = transcriptionCopy.stop(action.offer, usage?.plan ?? "free", usage?.resetsOn ?? null);
      const keep =
        onKeep === undefined || action.offer.status !== "not-enough"
          ? null
          : { label: `Keep it until ${backOn.replace(/^on /, "")}`, onPress: () => void onKeep().then(() => setKept(true)) };
      return <TranscriptionNotice notice={stop} route={stop.route} primary={keep} onFollowed={onFollowed} />;
    }
    default:
      return null;
  }
};

interface HoursLimitProps {
  copy: LimitCopy;
  keep: LimitWaitAction | null;
}

// Design 351g: the month's hours used, under the pasted link, with Plus and the wait.
const HoursLimit = ({ copy, keep }: HoursLimitProps) => {
  const { plan, chose } = usePlanPrompt({ kind: "hours" });
  const [plansOpen, setPlansOpen] = useState(false);
  return (
    <>
      <LimitInPlace
        {...copy}
        onGetPlus={() => {
          chose("seePlans");
          setPlansOpen(true);
        }}
        waitAction={
          keep === null
            ? null
            : {
                label: keep.label,
                onPress: () => {
                  chose("keptForReset");
                  keep.onPress();
                },
              }
        }
      />
      <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
    </>
  );
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
