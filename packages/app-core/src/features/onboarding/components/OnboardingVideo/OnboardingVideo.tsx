import { useState } from "react";
import { formatClock, type PlaylistLookup, type VideoSource } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingVideo.module.scss";
import { onboardingVideoTestIds } from "./OnboardingVideoTestIds.js";

export interface OnboardingVideoProps {
  video: VideoSource | null;
  // The playlist the link named, which starts with its first video; null for a video link.
  playlist: PlaylistLookup | null;
  failed: boolean;
  onLooksRight: () => void;
  onDifferentLink: () => void;
  onChooseVideo: (videoId: string) => void;
}

// Design 46c: the video the link found, once it has resolved, so the reader can say it's the
// wrong one before anything is written. A playlist starts with its first video, and any other
// can be chosen instead; the playlist itself isn't followed (docs/features/onboarding.md).
export function OnboardingVideo({ video, playlist, failed, onLooksRight, onDifferentLink, onChooseVideo }: OnboardingVideoProps) {
  const [choosing, setChoosing] = useState(false);
  const entries = playlist?.entries.filter((entry) => entry.availability === "available") ?? [];

  return (
    <div className={styles.root} data-testid={onboardingVideoTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>{playlist === null ? "Is this the right video?" : "Is this the right playlist?"}</OnboardingHeading>
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
        {video === null ? (
          <p className={styles.finding} data-testid={onboardingVideoTestIds.finding}>
            {failed ? "We couldn't find that video." : "Finding the video…"}
          </p>
        ) : (
          <div className={playlist === null ? styles.video : styles.videoSmall}>
            <OverviewThumbnail video={video} className={styles.thumb} />
            <span className={styles.meta}>
              <span className={styles.title} data-testid={onboardingVideoTestIds.title}>
                {video.title}
              </span>
              <span className={styles.byline}>
                {[video.channel, video.durationMs === null ? null : formatClock(video.durationMs / 1000)]
                  .filter(Boolean)
                  .join(" · ")}
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
                  aria-current={video?.id === entry.videoId ? "true" : undefined}
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
          disabled={video === null}
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
