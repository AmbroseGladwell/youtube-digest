import { useId, useState, type FormEvent } from "react";
import { DEFAULT_PLAN, domainOf, tiktokTitle } from "@overview/domain";
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
import type { RunError } from "../../types/RunError.js";
import { RunErrorMessage } from "../RunErrorMessage/RunErrorMessage.js";
import styles from "./GenerateOverviewForm.module.scss";
import { generateOverviewFormTestIds } from "./GenerateOverviewFormTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { UsageLine } from "../UsageLine/UsageLine.js";
import { LimitMessageNote } from "../LimitMessageNote/LimitMessageNote.js";
import { useLimitMessage } from "../../useLimitMessage.js";
import { isArticleLink, useArticleLink } from "../../useArticleLink.js";
import { useStartArticleFromLink } from "../../useStartArticleFromLink.js";
import { PastedLinkStatus } from "../PastedLinkStatus/PastedLinkStatus.js";
import { isPlatformPodcastLink, usePodcastLink } from "../../usePodcastLink.js";
import { isTikTokLink, useTikTokLink } from "../../useTikTokLink.js";
import { useNewOverviewRunController } from "../../NewOverviewRunContext.js";
import { pastedLinkState } from "../../util/pastedLinkState.js";
import { resetDate } from "../../util/usageLine.js";
import { useNextQuota } from "../../useNextQuota.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { SoftWall } from "../SoftWall/SoftWall.js";
import { createLabelOf, transcribeChoiceOf } from "../../../podcasts/util/episodeActionOf.js";

export interface GenerateOverviewFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  onCancel: () => void;
  // docs/features/playlists.md, "Pasting a link".
  onPlaylist: (target: PlaylistTarget, pastedUrl: string) => void;
  generationError?: RunError | null;
  // So a limit message can take focus as it comes into view.
  active?: boolean;
}

// Null for a video, or a link that is neither.
export const playlistTargetOf = (url: string): PlaylistTarget | null => {
  const link = youTubeLink(url);
  if (link?.kind === "playlist") {
    return { kind: "playlist", playlistId: link.playlistId };
  }
  if (link?.kind === "unfollowable") {
    return { kind: "unfollowable", list: link.list, videoUrl: link.videoUrl };
  }
  return null;
};

const canReadClipboard = (): boolean => typeof navigator.clipboard?.readText === "function";

const urlPlaceholder = (articleAvailable: boolean, playlistsAvailable: boolean): string => {
  if (articleAvailable) {
    return "Paste a YouTube, podcast or article link";
  }
  return playlistsAvailable ? "Paste a YouTube video or playlist link" : "Paste a YouTube link";
};

export const GenerateOverviewForm = ({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
  onPlaylist,
  generationError = null,
  active = false,
}: GenerateOverviewFormProps) => {
  const playlistsAvailable = usePlaylistApi() !== null;
  const phone = useIsPhone();
  const link = youTubeLink(url);
  const choosing = playlistsAvailable && link?.kind === "videoInPlaylist" ? link : null;
  const takeLink = (value: string) => {
    onUrlChange(value);
    const target = playlistsAvailable ? playlistTargetOf(value) : null;
    if (target !== null) {
      onPlaylist(target, value);
    }
  };
  const activeVideoUrl = useActiveVideoUrl();
  const watchedTranscript = useWatchedTranscriptQuery();
  const readiness = useGenerationReadiness();
  const keysReady = readiness.ready;
  const limit = useLimitMessage();
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? DEFAULT_PLAN;
  // Plus keeps the note at the limit, since the wall's way on is Plus.
  const walled = limit !== null && plan !== "plus" && next?.kind === "spent" ? next : null;
  const [wallShown, setWallShown] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const analytics = useAnalytics();
  const urlFieldId = useId();
  const article = useArticleLink(url, "dialog");
  const startArticle = useStartArticleFromLink();
  const podcast = usePodcastLink(url);
  const tiktok = useTikTokLink(url);
  const { startPodcast, transcribeAgain, startTikTok, run } = useNewOverviewRunController();
  const { podcastShown, tiktokShown, reading, generateOffered, episodeAction } = pastedLinkState(article.link, podcast, tiktok.link);
  const settleTyping = useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({
      recognised: isYouTubeUrl(url) || (article.available && (isArticleLink(url) || isPlatformPodcastLink(url) || isTikTokLink(url))),
      from: "dialog",
    }),
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    settleTyping();
    const target = playlistsAvailable ? playlistTargetOf(url) : null;
    if (target !== null) {
      setValidationError(null);
      onPlaylist(target, url);
      return;
    }
    if (walled !== null && url.trim() !== "") {
      analytics.capture.newOverviewForm.wallShown({ plan });
      setWallShown(true);
      return;
    }
    if (choosing !== null || limit !== null) {
      return;
    }
    if (tiktokShown) {
      const transcribe = transcribeChoiceOf(episodeAction);
      if (tiktok.link.status === "found" && generateOffered && (tiktok.link.words !== null || transcribe !== undefined)) {
        setValidationError(null);
        startTikTok({ video: tiktok.link.video, words: tiktok.link.words, transcribe, from: "dialog" });
      }
      return;
    }
    if (podcastShown) {
      if (podcast.link.status === "found" && generateOffered && !reading) {
        setValidationError(null);
        startPodcast({
          episode: podcast.link.episode,
          sharedFrom: url.trim(),
          from: "dialog",
          transcribe: transcribeChoiceOf(episodeAction),
        });
      }
      return;
    }
    if (reading) {
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

  const isWatchedVideo = activeVideoUrl !== null && activeVideoUrl === url.trim();
  const offersWatchedVideo = activeVideoUrl !== null && !isWatchedVideo;
  const watchedCaptionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  const pastedLink = () => {
    if (tiktok.link.status === "found") {
      return {
        kicker: `@${tiktok.link.video.handle} · TikTok`,
        title: tiktokTitle(tiktok.link.video.description, tiktok.link.video.handle),
      };
    }
    if (podcast.link.status === "found") {
      return { kicker: `${podcast.link.episode.showName} · Podcast`, title: podcast.link.episode.title };
    }
    if (article.link.status === "found") {
      return {
        kicker: `${article.link.article.siteName ?? domainOf(url)} · ${article.link.article.recipe === null ? "Article" : "Recipe"}`,
        title: article.link.article.title,
      };
    }
    return { kicker: isYouTubeUrl(url) ? "YouTube · Video" : null, title: url.trim() };
  };

  const readsWhat = () => {
    if (tiktokShown) {
      return episodeAction?.kind === "transcribe" || episodeAction?.kind === "free"
        ? "Transcribes the TikTok’s sound"
        : "Reads the TikTok’s captions";
    }
    if (podcastShown) {
      return "Finds the episode’s transcript";
    }
    if (article.link.status === "none") {
      return "Fetches the transcript";
    }
    return article.link.status === "found" && article.link.article.recipe !== null ? "Reads the recipe" : "Reads the article";
  };

  const limitOrNote = () => {
    if (limit !== null && walled === null) {
      return (
        <LimitMessageNote
          message={limit}
          from="dialog"
          testIds={generateOverviewFormTestIds.limitMessage}
          takeFocus={active}
          onFollowed={onCancel}
        />
      );
    }
    if (keysReady) {
      return <p className={styles.note}>{readsWhat()}, then writes the overview. Nothing is saved to your library unless both succeed.</p>;
    }
    return (
      <KeyPromptNote
        testIds={generateOverviewFormTestIds.keyPrompt}
        readiness={readiness}
        detail={keyPromptDetail(readiness)}
        from="dialog"
        onFollowed={onCancel}
      />
    );
  };

  if (wallShown && walled !== null) {
    const pasted = pastedLink();
    return (
      <>
        <SoftWall
          link={pasted}
          resetsOn={resetDate(walled.resetsOn)}
          offerKey={plan === "free" && !readiness.hasChosenKey}
          onSeePlans={() => {
            analytics.capture.newOverviewForm.plansOpened({ from: "wall" });
            setPlansOpen(true);
          }}
          onFollowed={onCancel}
        />
        <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
      </>
    );
  }

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
          placeholder={urlPlaceholder(article.available, playlistsAvailable)}
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

      <PastedLinkStatus
        article={article}
        podcast={podcast}
        tiktok={tiktok}
        url={url.trim()}
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

      {limitOrNote()}

      {validationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.validationError}>
          {validationError}
        </p>
      )}

      {generationError && (
        <RunErrorMessage
          error={generationError}
          className={styles.error}
          testId={generateOverviewFormTestIds.generationError}
          testIds={generateOverviewFormTestIds.runError}
          onFollowed={onCancel}
          episodeSeconds={run?.podcast?.durationSeconds ?? run?.tiktok?.durationSeconds ?? null}
          onTranscribe={transcribeAgain}
          onNotNow={onCancel}
        />
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
        {choosing === null && (limit === null || walled !== null) && generateOffered && (
          <button
            type="submit"
            className={styles.generateButton}
            disabled={!keysReady || reading}
            data-testid={generateOverviewFormTestIds.generateButton}
          >
            {episodeAction === null ? "Generate" : createLabelOf(episodeAction, "Generate")}
          </button>
        )}
      </div>

      {keysReady && limit === null && <UsageLine testIds={generateOverviewFormTestIds.usageLine} onPlanFollowed={onCancel} />}
    </form>
  );
};
