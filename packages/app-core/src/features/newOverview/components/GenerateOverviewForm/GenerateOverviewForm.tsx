import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { Routes } from "../../../../app/Routes.js";
import {
  settingsLinkLabel,
  transcriptSourceNote,
} from "../../../transcripts/transcriptSourceNote.js";
import { useGenerationReadiness } from "../../useGenerationReadiness.js";
import { useWatchedTranscriptQuery } from "../../../transcripts/queries/watchedTranscriptQuery.js";
import { isYouTubeUrl, youTubeLink } from "../../util/parseYouTubeUrl.js";
import { PlaylistLinkChoice } from "../../../playlists/components/PlaylistLinkChoice/PlaylistLinkChoice.js";
import type { PlaylistTarget } from "../../../playlists/components/PlaylistFollowFlow/PlaylistFollowFlow.js";
import { usePlaylistApi } from "../../../playlists/usePlaylistApi.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import styles from "./GenerateOverviewForm.module.scss";
import { generateOverviewFormTestIds } from "./GenerateOverviewFormTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";

export interface GenerateOverviewFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onCancel: () => void;
  // A playlist link, or one that can't be followed, goes to the playlist flow instead
  // (docs/features/playlists.md, "Pasting a link").
  onPlaylist: (target: PlaylistTarget, pastedUrl: string) => void;
  generationError?: string | null;
}

// What a link means once it is complete: a playlist to look up, or one to refuse. Null
// for a video, or a link that is neither.
export function playlistTargetOf(url: string): PlaylistTarget | null {
  const link = youTubeLink(url);
  if (link?.kind === "playlist") return { kind: "playlist", playlistId: link.playlistId };
  if (link?.kind === "unfollowable") return { kind: "unfollowable", list: link.list, videoUrl: link.videoUrl };
  return null;
}

const canReadClipboard = (): boolean => typeof navigator.clipboard?.readText === "function";

export function GenerateOverviewForm({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
  onPlaylist,
  generationError = null,
}: GenerateOverviewFormProps) {
  const playlistsAvailable = usePlaylistApi() !== null;
  const phone = useIsPhone();
  const link = youTubeLink(url);
  const choosing = playlistsAvailable && link?.kind === "videoInPlaylist" ? link : null;
  const takeLink = (value: string) => {
    onUrlChange(value);
    const target = playlistsAvailable ? playlistTargetOf(value) : null;
    if (target !== null) onPlaylist(target, value);
  };
  const activeVideoUrl = useActiveVideoUrl();
  const watchedTranscript = useWatchedTranscriptQuery();
  const readiness = useGenerationReadiness();
  const keysReady = readiness === "ready";
  const [validationError, setValidationError] = useState<string | null>(null);
  const analytics = useAnalytics();
  useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({ recognised: isYouTubeUrl(url), from: "dialog" }),
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = playlistsAvailable ? playlistTargetOf(url) : null;
    if (target !== null) {
      setValidationError(null);
      onPlaylist(target, url);
      return;
    }
    if (choosing !== null) {
      return;
    }
    if (!isYouTubeUrl(url)) {
      analytics.capture.newOverviewForm.linkRefused({ from: "dialog" });
      setValidationError("That doesn't look like a YouTube URL.");
      return;
    }
    setValidationError(null);
    onSubmit(url);
  };

  const isWatchedVideo = activeVideoUrl !== null && activeVideoUrl === url.trim();
  const offersWatchedVideo = activeVideoUrl !== null && !isWatchedVideo;
  const watchedCaptionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  return (
    <form
      className={styles.root}
      onSubmit={handleSubmit}
      data-testid={generateOverviewFormTestIds.root}
    >
      <label className={styles.field}>
        <span className={styles.label}>YouTube link</span>
        <input
          type="url"
          className={styles.urlInput}
          placeholder={playlistsAvailable ? "Paste a YouTube video or playlist link" : "Paste a YouTube link"}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (playlistsAvailable && playlistTargetOf(pasted) !== null) {
              event.preventDefault();
              takeLink(pasted);
            }
          }}
          disabled={!keysReady}
          autoFocus
          data-testid={generateOverviewFormTestIds.urlInput}
        />
      </label>

      {isWatchedVideo && (
        <p className={styles.provenance} data-testid={generateOverviewFormTestIds.watchingNote}>
          The video you're watching, already filled in.
          {watchedTranscript.isFetching && " Fetching its captions now."}
          {watchedCaptionsHeld &&
            " Its captions are already here, so generating won't buy them again."}
        </p>
      )}

      {offersWatchedVideo && (
        <button
          type="button"
          className={styles.watchingButton}
          onClick={() => {
            analytics.capture.newOverviewForm.watchingVideoUsed();
            onUrlChange(activeVideoUrl);
          }}
          disabled={!keysReady}
          data-testid={generateOverviewFormTestIds.watchingButton}
        >
          Use the video you're watching
        </button>
      )}

      {canReadClipboard() && (
        <button
          type="button"
          className={styles.pasteButton}
          onClick={() => {
            analytics.capture.newOverviewForm.clipboardPasted();
            void navigator.clipboard.readText().then(takeLink);
          }}
          disabled={!keysReady}
          data-testid={generateOverviewFormTestIds.pasteButton}
        >
          Paste from clipboard
        </button>
      )}

      {keysReady ? (
        <p className={styles.note}>
          Fetches the transcript, then writes the overview. Nothing is saved to your library unless
          both succeed.
        </p>
      ) : (
        <p className={styles.note}>
          {transcriptSourceNote(readiness)}{" "}
          <Link
            to={Routes.settingsSection("keys")}
            onClick={() => {
              analytics.capture.newOverviewForm.keysLinkFollowed({ from: "dialog" });
              onCancel();
            }}
            data-testid={generateOverviewFormTestIds.settingsLink}
          >
            {settingsLinkLabel(readiness)}
          </Link>
        </p>
      )}

      {validationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.validationError}>
          {validationError}
        </p>
      )}

      {generationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.generationError}>
          {generationError}
        </p>
      )}

      {choosing !== null && (
        <PlaylistLinkChoice
          playlistId={choosing.playlistId}
          disabled={!keysReady}
          stacked={phone}
          onVideo={() => onSubmit(choosing.videoUrl)}
          onPlaylist={() => onPlaylist({ kind: "playlist", playlistId: choosing.playlistId }, url)}
        />
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          data-testid={generateOverviewFormTestIds.cancelButton}
        >
          Cancel
        </button>
        {choosing === null && (
          <button
            type="submit"
            className={styles.generateButton}
            disabled={!keysReady}
            data-testid={generateOverviewFormTestIds.generateButton}
          >
            Generate
          </button>
        )}
      </div>
    </form>
  );
}
