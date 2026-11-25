import { useState } from "react";
import { formatClock, tiktokTitle, type TikTokVideo } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { EpisodeWordsNote } from "../PodcastLinkStatus/PodcastLinkStatus.js";
import type { TikTokLink, TikTokLinkFailure } from "../../useTikTokLink.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { KeepForExtension } from "../../../captures/components/KeepForExtension/KeepForExtension.js";
import { useNewOverviewRunController } from "../../NewOverviewRunContext.js";
import { tiktokLinkFailureCopy, tiktokStopCopy } from "../../util/tiktokLinkFailureCopy.js";
import styles from "./TikTokLinkStatus.module.scss";
import { tiktokLinkStatusTestIds } from "./TikTokLinkStatusTestIds.js";

export interface TikTokLinkStatusProps {
  link: TikTokLink;
  url: string;
  onRetry: () => void;
  onClear: () => void;
  onOpened?: () => void;
}

const madeOn = (savedAt: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

const lengthOf = (video: Pick<TikTokVideo, "durationSeconds">): string | null =>
  video.durationSeconds === null ? null : formatClock(video.durationSeconds);

// "0:58 · Posted 18 Nov 2026", leaving out what TikTok didn't give (130a).
export const tiktokFacts = (video: Pick<TikTokVideo, "durationSeconds" | "postedAt">): string =>
  [lengthOf(video), video.postedAt === null ? null : `Posted ${formatPublishedDate(video.postedAt)}`].filter(Boolean).join(" · ");

// Failures our server meets that the reader's own browser can get past (docs/features/tiktok-links.md, "Who reads TikTok").
const NOT_KEEPABLE = new Set<TikTokLinkFailure>(["unavailable", "photo", "profile"]);

export const TikTokLinkStatus = ({ link, url, onRetry, onClear, onOpened }: TikTokLinkStatusProps) => {
  const surface = useSurface();
  const { keepForExtension } = useNewOverviewRunController();
  switch (link.status) {
    case "none":
      return null;
    case "reading":
      return (
        <div className={styles.card} data-testid={tiktokLinkStatusTestIds.reading}>
          <span className={styles.blank} aria-hidden="true" />
          <span className={styles.words}>
            <span className={styles.kicker}>TikTok</span>
            <span className={styles.finding} role="status">
              Finding the video…
            </span>
          </span>
        </div>
      );
    case "found":
      return (
        <>
          <TikTokCard video={link.video} />
          {link.words === null && (
            <ul className={styles.looked} data-testid={tiktokLinkStatusTestIds.looked}>
              <li>
                <StrokeIcon name="check" size={13} />
                Found the video <small>· TikTok{lengthOf(link.video) === null ? "" : ` · ${lengthOf(link.video)}`}</small>
              </li>
              <li>
                <StrokeIcon name="check" size={13} />
                Looked for captions <small>· none</small>
              </li>
              {link.transcription?.status === "needed" && (
                <li data-testid={tiktokLinkStatusTestIds.needs}>
                  <StrokeIcon name="mic" size={13} />
                  {transcriptionCopy.needs(link.video.durationSeconds)}
                </li>
              )}
            </ul>
          )}
          {link.words === null && link.stop === null && link.transcription !== null && (
            <EpisodeWordsNote
              words={{ state: "none", transcription: link.transcription }}
              episodeSeconds={link.video.durationSeconds}
              onFollowed={onOpened}
              source="tiktok"
            />
          )}
          {link.stop !== null && <ArticleFailureNotice copy={tiktokStopCopy(link.stop)} onWay={onClear} prominent />}
        </>
      );
    case "held":
      return (
        <div className={styles.held} data-testid={tiktokLinkStatusTestIds.held}>
          <span>
            You already have this TikTok.
            {link.savedAt !== null && ` You made an overview of it on ${madeOn(link.savedAt)}.`}
          </span>
          <PageLink
            className={styles.open}
            to={Routes.overview(link.overviewId)}
            onClick={onOpened}
            data-testid={tiktokLinkStatusTestIds.openHeld}
          >
            Open your overview
          </PageLink>
        </div>
      );
    case "unreachable":
    case "failed": {
      const copy = tiktokLinkFailureCopy(link.status === "failed" ? link.reason : "unreachable");
      const keepable = link.status === "failed" && !NOT_KEEPABLE.has(link.reason) && surface !== "extension";
      return (
        <>
          <ArticleFailureNotice copy={copy} onWay={copy.way === "tryAgain" ? onRetry : onClear} prominent={copy.way === "tryAnother"} />
          {keepable && <KeepForExtension onKeep={() => keepForExtension(url, null)} />}
        </>
      );
    }
  }
};

export interface TikTokCardProps {
  video: TikTokVideo;
  // Inside the panel's offer it sits on the surface tint, not as a card of its own (130i).
  tinted?: boolean;
}

export const TikTokCard = ({ video, tinted = false }: TikTokCardProps) => {
  const [failed, setFailed] = useState(false);
  const caption = video.description.trim();
  const words = tiktokTitle(video.description, video.handle);
  const hashtags = caption !== "" && words !== caption && caption.startsWith(words) ? caption.slice(words.length).trim() : "";
  const length = lengthOf(video);
  return (
    <div className={`${styles.card} ${tinted ? styles.tinted : ""}`} data-testid={tiktokLinkStatusTestIds.found}>
      <span className={styles.cover}>
        {video.coverUrl !== null && !failed && (
          <img className={styles.coverImage} src={video.coverUrl} alt="" onError={() => setFailed(true)} />
        )}
        <span className={styles.coverPlay} aria-hidden="true">
          <StrokeIcon name="play" size={18} />
        </span>
        {length !== null && (
          <span className={styles.length} data-testid={tiktokLinkStatusTestIds.length}>
            {length}
          </span>
        )}
      </span>
      <span className={styles.words}>
        <span className={styles.kicker} data-testid={tiktokLinkStatusTestIds.kicker}>
          @{video.handle} · TikTok
        </span>
        <span className={`${styles.title} ${caption === "" ? styles.untitled : ""}`} data-testid={tiktokLinkStatusTestIds.title}>
          {words}
          {hashtags !== "" && (
            <>
              {" "}
              <span className={styles.hashtags} data-testid={tiktokLinkStatusTestIds.hashtags}>
                {hashtags}
              </span>
            </>
          )}
        </span>
        <span className={styles.facts} data-testid={tiktokLinkStatusTestIds.facts}>
          {tiktokFacts(video)}
        </span>
      </span>
    </div>
  );
};
