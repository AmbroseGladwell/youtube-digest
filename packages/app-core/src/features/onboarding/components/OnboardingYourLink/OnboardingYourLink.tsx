import { useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import type { PlaylistLookup } from "@overview/domain";
import type { OnboardingFound, OnboardingLinkKind, OnboardingSource } from "../../onboardingSources.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { OnboardingPills } from "../OnboardingPills/OnboardingPills.js";
import { OnboardingSourceCard } from "../OnboardingSourceCard/OnboardingSourceCard.js";
import { expectedOverviewMinutes } from "../../util/expectedOverviewMinutes.js";
import styles from "./OnboardingYourLink.module.scss";
import { onboardingYourLinkTestIds } from "./OnboardingYourLinkTestIds.js";

export interface OnboardingYourLinkProps {
  kind: OnboardingSource | null;
  linkKind: OnboardingLinkKind;
  link: string;
  found: OnboardingFound | null;
  playlist: PlaylistLookup | null;
  failed: boolean;
  onLooksRight: () => void;
  onDifferentLink: () => void;
  onChooseVideo: (videoId: string) => void;
}

const sourceCardSize = (hasPlaylist: boolean, isPanel: boolean): "small" | "compact" | "row" => {
  if (hasPlaylist) {
    return "small";
  }
  return isPanel ? "compact" : "row";
};

// Shown before anything is written, so the reader can say it's the wrong one (327c, 327s–327v).
export const OnboardingYourLink = ({
  kind,
  linkKind,
  link,
  found,
  playlist,
  failed,
  onLooksRight,
  onDifferentLink,
  onChooseVideo,
}: OnboardingYourLinkProps) => {
  const [choosing, setChoosing] = useState(false);
  const isPanel = useIsPanel();
  const entries = playlist?.entries.filter((entry) => entry.availability === "available") ?? [];
  const pending = found === null && !failed ? (kind?.pending(link) ?? null) : null;
  const minutes = found === null ? null : expectedOverviewMinutes(found.source);
  const words = found === null || kind === null ? null : kind.yourLink(found, minutes);
  const stop = words?.stop ?? null;
  const heading = words?.heading ?? (playlist !== null ? "Here’s the playlist you saved." : "Here’s what you saved.");

  const sourceCard = () => {
    if (found !== null && kind !== null) {
      return <OnboardingSourceCard kind={kind} found={found} size={sourceCardSize(playlist !== null, isPanel)} />;
    }
    if (pending !== null) {
      return (
        <div className={styles.pending}>
          <span className={styles.domain}>{pending}</span>
          <span className={styles.skeleton} aria-hidden="true">
            <span />
            <span style={{ width: "72%" }} />
          </span>
          <p className={styles.reading} role="status" data-testid={onboardingYourLinkTestIds.finding}>
            {kind?.finding}
          </p>
        </div>
      );
    }
    return (
      <p className={styles.finding} data-testid={onboardingYourLinkTestIds.finding}>
        {failed ? (kind?.notFound ?? "We couldn't find that video.") : (kind?.finding ?? "Finding the video…")}
      </p>
    );
  };

  return (
    <div className={styles.root} data-testid={onboardingYourLinkTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading key={heading}>{heading}</OnboardingHeading>
        {words !== null && (
          <p className={styles.lead} data-testid={onboardingYourLinkTestIds.line}>
            {words.line}
          </p>
        )}
      </div>

      <div className={styles.card}>
        {playlist !== null && (
          <span className={styles.meta}>
            <span className={styles.kicker}>
              {[playlist.owner, "Playlist", `${playlist.entries.length} videos`].filter(Boolean).join(" · ")}
            </span>
            <span className={styles.title} data-testid={onboardingYourLinkTestIds.playlistTitle}>
              {playlist.title}
            </span>
          </span>
        )}
        {playlist !== null && <span className={styles.startWith}>We'll start with the first video</span>}
        {sourceCard()}
        {playlist !== null && entries.length > 1 && !choosing && (
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => setChoosing(true)}
            data-testid={onboardingYourLinkTestIds.chooseDifferent}
          >
            Choose a different video
          </button>
        )}
        {choosing && (
          <ul className={styles.entries} aria-label="Videos in this playlist">
            {entries.map((entry) => (
              <li key={entry.videoId}>
                <button
                  type="button"
                  className={styles.entry}
                  aria-current={found?.source.id === entry.videoId ? "true" : undefined}
                  onClick={() => {
                    setChoosing(false);
                    onChooseVideo(entry.videoId);
                  }}
                  data-testid={onboardingYourLinkTestIds.entry(entry.videoId)}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {found !== null && kind !== null && words !== null && (
        <>
          {stop !== null ? (
            <p className={styles.stop} role="alert" data-testid={onboardingYourLinkTestIds.stop}>
              {stop}
            </p>
          ) : (
            <>
              {words.notice != null && (
                <p className={styles.notice} data-testid={onboardingYourLinkTestIds.notice}>
                  {words.notice}
                </p>
              )}
              <OnboardingPills pills={words.pills} minutes={minutes} />
              <div className={styles.details}>
                <p className={styles.inside} data-testid={onboardingYourLinkTestIds.inside}>
                  {words.inside}
                </p>
                <p className={styles.saved}>
                  <StrokeIcon name="folder" size={14} />
                  Saved to your library, ready for you and your AI.
                </p>
              </div>
            </>
          )}
        </>
      )}

      <div className={styles.foot}>
        {stop === null && (
          <button
            type="button"
            className={styles.primary}
            disabled={found === null}
            onClick={onLooksRight}
            data-testid={onboardingYourLinkTestIds.looksRight}
          >
            Looks right
          </button>
        )}
        <button
          type="button"
          className={stop === null ? styles.quiet : styles.primary}
          onClick={onDifferentLink}
          data-testid={onboardingYourLinkTestIds.differentLink}
        >
          Use a different link
        </button>
      </div>
    </div>
  );
};
