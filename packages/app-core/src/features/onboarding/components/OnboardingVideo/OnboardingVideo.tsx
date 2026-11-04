import { useState } from "react";
import type { PlaylistLookup } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import type { OnboardingFound, OnboardingLinkKind, OnboardingSource } from "../../onboardingSources.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingVideo.module.scss";
import { onboardingVideoTestIds } from "./OnboardingVideoTestIds.js";

export interface OnboardingVideoProps {
  kind: OnboardingSource | null;
  linkKind: OnboardingLinkKind;
  found: OnboardingFound | null;
  // The playlist the link named, which starts with its first video; null for a video link.
  playlist: PlaylistLookup | null;
  failed: boolean;
  onLooksRight: () => void;
  onDifferentLink: () => void;
  onChooseVideo: (videoId: string) => void;
}

// Design 46c: what the link found, once it has resolved, so the reader can say it's the
// wrong one before anything is written. Kinds differ only by what onboardingSources says. A playlist starts with its first video, and any other
// can be chosen instead; the playlist itself isn't followed (docs/features/onboarding.md).
export function OnboardingVideo({
  kind,
  linkKind,
  found,
  playlist,
  failed,
  onLooksRight,
  onDifferentLink,
  onChooseVideo,
}: OnboardingVideoProps) {
  const [choosing, setChoosing] = useState(false);
  const source = found?.source ?? null;
  const noun = kind?.noun(linkKind, found) ?? "video";
  const entries = playlist?.entries.filter((entry) => entry.availability === "available") ?? [];

  return (
    <div className={styles.root} data-testid={onboardingVideoTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>{playlist === null ? `Is this the right ${noun}?` : "Is this the right playlist?"}</OnboardingHeading>
        <p className={styles.lead}>We'll turn it into an overview you can read, listen to and come back to.</p>
      </div>

      <div className={styles.card}>
        {playlist !== null && (
          <span className={styles.meta}>
            <span className={styles.title} data-testid={onboardingVideoTestIds.playlistTitle}>
              {playlist.title}
            </span>
            <span className={styles.byline}>
              {[playlist.owner, "Playlist", `${playlist.entries.length} videos`].filter(Boolean).join(" · ")}
            </span>
          </span>
        )}
        {playlist !== null && <span className={styles.startWith}>We'll start with this video</span>}
        {found === null || source === null ? (
          <p className={styles.finding} data-testid={onboardingVideoTestIds.finding}>
            {failed ? (kind?.notFound ?? "We couldn't find that video.") : (kind?.finding ?? "Finding the video…")}
          </p>
        ) : (
          <div className={playlist === null ? styles.video : styles.videoSmall}>
            <OverviewThumbnail video={source} className={styles.thumb} />
            <span className={styles.meta}>
              <span className={styles.title} data-testid={onboardingVideoTestIds.title}>
                {source.title}
              </span>
              <span className={styles.byline} data-testid={onboardingVideoTestIds.byline}>
                {kind?.byline(found)}
              </span>
            </span>
          </div>
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
                  aria-current={source?.id === entry.videoId ? "true" : undefined}
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
