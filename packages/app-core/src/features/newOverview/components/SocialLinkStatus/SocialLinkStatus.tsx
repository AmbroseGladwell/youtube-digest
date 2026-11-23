import { useState } from "react";
import { formatClock, SOCIAL_PLATFORM_NAME, socialTitle, wordCount, type SocialPost } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import { transcriptionCopy } from "../../../podcasts/util/transcriptionCopy.js";
import { EpisodeWordsNote } from "../PodcastLinkStatus/PodcastLinkStatus.js";
import type { useSocialLink } from "../../useSocialLink.js";
import { socialLinkFailureCopy, socialStopCopy } from "../../util/socialLinkFailureCopy.js";
import styles from "./SocialLinkStatus.module.scss";
import { socialLinkStatusTestIds } from "./SocialLinkStatusTestIds.js";

export interface SocialLinkStatusProps {
  social: ReturnType<typeof useSocialLink>;
  onClear: () => void;
  onOpened?: (() => void) | undefined;
}

const madeOn = (savedAt: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

const lengthOf = (post: Pick<SocialPost, "durationSeconds">): string | null =>
  post.durationSeconds === null ? null : formatClock(post.durationSeconds);

const posted = (post: Pick<SocialPost, "postedAt">): string | null =>
  post.postedAt === null ? null : `Posted ${formatPublishedDate(post.postedAt)}`;

// "0:58 · Posted 18 Nov 2026" for a video; "Photo post · 120 words" for the rest, read for its description.
export const socialFacts = (post: SocialPost): string => {
  const what =
    post.media === "video" ? lengthOf(post) : `${post.media === "photo" ? "Photo" : "Text"} post · ${wordCount(post.description)} words`;
  return [what, posted(post)].filter(Boolean).join(" · ");
};

export const SocialLinkStatus = ({ social, onClear, onOpened }: SocialLinkStatusProps) => {
  const { link, platform, retry } = social;
  const name = platform === null ? "" : SOCIAL_PLATFORM_NAME[platform];
  switch (link.status) {
    case "none":
      return null;
    case "reading":
      return (
        <div className={styles.card} data-testid={socialLinkStatusTestIds.reading}>
          <span className={styles.blank} aria-hidden="true" />
          <span className={styles.words}>
            <span className={styles.kicker}>{name}</span>
            <span className={styles.finding} role="status">
              Finding the post…
            </span>
          </span>
        </div>
      );
    case "found": {
      const { post } = link;
      return (
        <>
          <SocialCard post={post} />
          {post.media === "video" && link.words === null && (
            <ul className={styles.looked} data-testid={socialLinkStatusTestIds.looked}>
              <li>
                <StrokeIcon name="check" size={13} />
                Found the video{" "}
                <small>
                  · {SOCIAL_PLATFORM_NAME[post.platform]}
                  {lengthOf(post) === null ? "" : ` · ${lengthOf(post)}`}
                </small>
              </li>
              <li>
                <StrokeIcon name="check" size={13} />
                Looked for captions <small>· none</small>
              </li>
              {link.transcription?.status === "needed" && (
                <li data-testid={socialLinkStatusTestIds.needs}>
                  <StrokeIcon name="mic" size={13} />
                  {transcriptionCopy.needs(post.durationSeconds)}
                </li>
              )}
            </ul>
          )}
          {post.media === "video" && link.words === null && link.stop === null && link.transcription !== null && (
            <EpisodeWordsNote
              words={{ state: "none", transcription: link.transcription }}
              episodeSeconds={post.durationSeconds}
              onFollowed={onOpened}
              source={post.platform}
            />
          )}
          {link.stop !== null && <ArticleFailureNotice copy={socialStopCopy(link.stop)} onWay={onClear} prominent />}
        </>
      );
    }
    case "held":
      return (
        <div className={styles.held} data-testid={socialLinkStatusTestIds.held}>
          <span>
            You already have this post.
            {link.savedAt !== null && ` You made an overview of it on ${madeOn(link.savedAt)}.`}
          </span>
          <PageLink
            className={styles.open}
            to={Routes.overview(link.overviewId)}
            onClick={onOpened}
            data-testid={socialLinkStatusTestIds.openHeld}
          >
            Open your overview
          </PageLink>
        </div>
      );
    case "unreachable":
    case "failed": {
      const copy = socialLinkFailureCopy(link.status === "failed" ? link.reason : "unreachable", platform);
      return <ArticleFailureNotice copy={copy} onWay={copy.way === "tryAgain" ? retry : onClear} prominent={copy.way === "tryAnother"} />;
    }
  }
};

export interface SocialCardProps {
  post: SocialPost;
  // Inside the panel's offer it sits on the surface tint, not as a card of its own (130i).
  tinted?: boolean;
}

export const SocialCard = ({ post, tinted = false }: SocialCardProps) => {
  const [failed, setFailed] = useState(false);
  const length = lengthOf(post);
  const by = post.handle === null ? post.authorName : `@${post.handle}`;
  return (
    <div className={`${styles.card} ${tinted ? styles.tinted : ""}`} data-testid={socialLinkStatusTestIds.found}>
      <span className={styles.cover}>
        {post.coverUrl !== null && !failed && (
          <img className={styles.coverImage} src={post.coverUrl} alt="" onError={() => setFailed(true)} />
        )}
        {post.media === "video" && (
          <span className={styles.coverPlay} aria-hidden="true">
            <StrokeIcon name="play" size={18} />
          </span>
        )}
        {length !== null && (
          <span className={styles.length} data-testid={socialLinkStatusTestIds.length}>
            {length}
          </span>
        )}
      </span>
      <span className={styles.words}>
        <span className={styles.kicker} data-testid={socialLinkStatusTestIds.kicker}>
          {[by, SOCIAL_PLATFORM_NAME[post.platform]].filter((part) => part.trim() !== "").join(" · ")}
        </span>
        <span
          className={`${styles.title} ${post.description.trim() === "" ? styles.untitled : ""}`}
          data-testid={socialLinkStatusTestIds.title}
        >
          {socialTitle(post)}
        </span>
        <span className={styles.facts} data-testid={socialLinkStatusTestIds.facts}>
          {socialFacts(post)}
        </span>
      </span>
    </div>
  );
};
