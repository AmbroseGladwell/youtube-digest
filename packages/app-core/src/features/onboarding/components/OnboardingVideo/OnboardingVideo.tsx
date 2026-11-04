import { useState } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import type { PlaylistLookup } from "@overview/domain";
import type { OnboardingFound, OnboardingLinkKind, OnboardingSource } from "../../onboardingSources.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { OnboardingSourceCard } from "../OnboardingSourceCard/OnboardingSourceCard.js";
import styles from "./OnboardingVideo.module.scss";
import { onboardingVideoTestIds } from "./OnboardingVideoTestIds.js";

export interface OnboardingVideoProps {
  kind: OnboardingSource | null;
  linkKind: OnboardingLinkKind;
  link: string;
  found: OnboardingFound | null;
  // The playlist the link named, which starts with its first video; null for any other link.
  playlist: PlaylistLookup | null;
  failed: boolean;
  onLooksRight: () => void;
  onDifferentLink: () => void;
  onChooseVideo: (videoId: string) => void;
}

// Designs 46c and 154d–154g: what the link found, so the reader can say it's the wrong one before
// anything is written. One card for every kind; it grows a lower row only when there's a choice
// inside it, as a playlist's first video is. The heading names the noun, and takes focus again
// when the read changes it from "page" to "article" or "recipe".
export function OnboardingVideo({
  kind,
  linkKind,
  link,
  found,
  playlist,
  failed,
  onLooksRight,
  onDifferentLink,
  onChooseVideo,
}: OnboardingVideoProps) {
  const [choosing, setChoosing] = useState(false);
  const isPanel = useIsPanel();
  const entries = playlist?.entries.filter((entry) => entry.availability === "available") ?? [];
  const noun = playlist !== null ? "playlist" : (kind?.noun(linkKind, found) ?? "video");
  const pending = found === null && !failed ? (kind?.pending(link) ?? null) : null;

  return (
    <div className={styles.root} data-testid={onboardingVideoTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading key={noun}>{`Is this the right ${noun}?`}</OnboardingHeading>
        <p className={styles.lead}>{kind?.lead(found)}</p>
      </div>

      <div className={styles.card}>
        {playlist !== null && (
          <span className={styles.meta}>
            <span className={styles.kicker}>
              {[playlist.owner, "Playlist", `${playlist.entries.length} videos`].filter(Boolean).join(" · ")}
            </span>
            <span className={styles.title} data-testid={onboardingVideoTestIds.playlistTitle}>
              {playlist.title}
            </span>
          </span>
        )}
        {playlist !== null && <span className={styles.startWith}>We'll start with the first video</span>}
        {found !== null && kind !== null ? (
          <OnboardingSourceCard kind={kind} found={found} size={playlist !== null ? "small" : isPanel ? "compact" : "large"} />
        ) : pending !== null ? (
          <div className={styles.pending}>
            <span className={styles.domain}>{pending}</span>
            <span className={styles.skeleton} aria-hidden="true">
              <span />
              <span style={{ width: "72%" }} />
            </span>
            <p className={styles.reading} role="status" data-testid={onboardingVideoTestIds.finding}>
              {kind?.finding}
            </p>
          </div>
        ) : (
          <p className={styles.finding} data-testid={onboardingVideoTestIds.finding}>
            {failed ? (kind?.notFound ?? "We couldn't find that video.") : (kind?.finding ?? "Finding the video…")}
          </p>
        )}
        {playlist !== null && entries.length > 1 && !choosing && (
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => setChoosing(true)}
            data-testid={onboardingVideoTestIds.chooseDifferent}
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
                  data-testid={onboardingVideoTestIds.entry(entry.videoId)}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.primary}
          disabled={found === null}
          onClick={onLooksRight}
          data-testid={onboardingVideoTestIds.looksRight}
        >
          Looks right
        </button>
        <button type="button" className={styles.quiet} onClick={onDifferentLink} data-testid={onboardingVideoTestIds.differentLink}>
          Use a different link
        </button>
      </div>
    </div>
  );
}
