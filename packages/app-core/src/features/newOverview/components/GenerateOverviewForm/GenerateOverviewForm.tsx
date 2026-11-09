import { useId, useState, type FormEvent } from "react";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { keyPromptDetail } from "../../../transcripts/transcriptSourceNote.js";
import { KeyPromptNote } from "../../../apiKeys/components/KeyPromptNote/KeyPromptNote.js";
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
import { UsageLine } from "../UsageLine/UsageLine.js";
import { LimitMessageNote } from "../LimitMessageNote/LimitMessageNote.js";
import { useLimitMessage } from "../../useLimitMessage.js";
import { isArticleLink, useArticleLink } from "../../useArticleLink.js";
import { useStartArticleFromLink } from "../../useStartArticleFromLink.js";
import { ArticleLinkStatus } from "../ArticleLinkStatus/ArticleLinkStatus.js";

export interface GenerateOverviewFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onCancel: () => void;
  // A playlist link, or one that can't be followed, goes to the playlist flow instead
  // (docs/features/playlists.md, "Pasting a link").
  onPlaylist: (target: PlaylistTarget, pastedUrl: string) => void;
  generationError?: string | null;
  // Whether the dialog holding the form is open, so a limit message can take focus as it
  // comes into view.
  active?: boolean;
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
  active = false,
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
  const keysReady = readiness.ready;
  const limit = useLimitMessage();
  const [validationError, setValidationError] = useState<string | null>(null);
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const article = useArticleLink(url, "dialog");
  const startArticle = useStartArticleFromLink();
  useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({
      recognised: isYouTubeUrl(url) || (article.available && isArticleLink(url)),
      from: "dialog",
    }),
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = playlistsAvailable ? playlistTargetOf(url) : null;
    if (target !== null) {
      setValidationError(null);
      onPlaylist(target, url);
      return;
    }
    if (choosing !== null || limit !== null) {
      return;
    }
    if (article.link.status === "found") {
      setValidationError(null);
      startArticle(article.link.article, "dialog");
      return;
    }
    if (article.link.status !== "none") {
      return;
    }
    if (!isYouTubeUrl(url)) {
      analytics.capture.newOverviewForm.linkRefused({ from: "dialog" });
      setValidationError(article.available ? "That doesn't look like a link we can read." : "That doesn't look like a YouTube URL.");
      return;
    }
    setValidationError(null);
    onSubmit(url);
  };
  const generateOffered = article.link.status !== "held" && article.link.status !== "failed";

  const isWatchedVideo = activeVideoUrl !== null && activeVideoUrl === url.trim();
  const offersWatchedVideo = activeVideoUrl !== null && !isWatchedVideo;
  const watchedCaptionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  return (
    <form className={styles.root} onSubmit={handleSubmit} data-testid={generateOverviewFormTestIds.root}>
      <label className={styles.field}>
        <span className={styles.label}>{article.available ? "Link" : "YouTube link"}</span>
        <input
          id={urlFieldId}
          name="video-url"
          type="url"
          autoComplete="off"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={styles.urlInput}
          placeholder={
            article.available
              ? "Paste a YouTube or article link"
              : playlistsAvailable
                ? "Paste a YouTube video or playlist link"
                : "Paste a YouTube link"
          }
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

      <ArticleLinkStatus
        link={article.link}
        url={url.trim()}
        place={article.place}
        onRetry={article.retry}
        onClear={() => onUrlChange("")}
        onOpened={onCancel}
      />

      {isWatchedVideo && (
        <p className={styles.provenance} data-testid={generateOverviewFormTestIds.watchingNote}>
          The video you're watching, already filled in.
          {watchedTranscript.isFetching && " Fetching its captions now."}
          {watchedCaptionsHeld && " Its captions are already here, so generating won't buy them again."}
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

      {limit !== null ? (
        <LimitMessageNote
          message={limit}
          from="dialog"
          testIds={generateOverviewFormTestIds.limitMessage}
          takeFocus={active}
          onFollowed={onCancel}
        />
      ) : keysReady ? (
        <p className={styles.note}>
          {article.link.status === "none"
            ? "Fetches the transcript"
            : article.link.status === "found" && article.link.article.recipe !== null
              ? "Reads the recipe"
              : "Reads the article"}
          , then writes the overview. Nothing is saved to your library unless both succeed.
        </p>
      ) : (
        <KeyPromptNote
          testIds={generateOverviewFormTestIds.keyPrompt}
          readiness={readiness}
          detail={keyPromptDetail(readiness)}
          from="dialog"
          onFollowed={onCancel}
        />
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
        <button type="button" className={styles.cancelButton} onClick={onCancel} data-testid={generateOverviewFormTestIds.cancelButton}>
          Cancel
        </button>
        {choosing === null && limit === null && generateOffered && (
          <button
            type="submit"
            className={styles.generateButton}
            disabled={!keysReady || article.link.status === "reading"}
            data-testid={generateOverviewFormTestIds.generateButton}
          >
            Generate
          </button>
        )}
      </div>

      {keysReady && limit === null && <UsageLine testIds={generateOverviewFormTestIds.usageLine} onPlanFollowed={onCancel} />}
    </form>
  );
}
