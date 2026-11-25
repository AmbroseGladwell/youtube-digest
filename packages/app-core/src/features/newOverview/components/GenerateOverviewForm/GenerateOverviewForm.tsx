import type { Overview } from "@overview/domain";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { captureSurfaceOf } from "../../../captures/util/captureSurfaceOf.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { JustNowList } from "../JustNowList/JustNowList.js";
import { newOverviewDialogTestIds } from "../NewOverviewDialog/NewOverviewDialogTestIds.js";
import { SavedForNow } from "../SoftWall/SavedForNow.js";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { DEFAULT_PLAN, domainOf, SOCIAL_PLATFORM_NAME, socialTitle, tiktokTitle } from "@overview/domain";
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
import { isSocialLink, useSocialLink } from "../../useSocialLink.js";
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
  onSubmit: (url: string, options?: { saveInstead: boolean }) => void;
  onCancel: () => void;
  // docs/features/playlists.md, "Pasting a link".
  onPlaylist: (target: PlaylistTarget, pastedUrl: string) => void;
  // So a limit message can take focus as it comes into view.
  active?: boolean;
  onReadOverview: (overview: Overview) => void;
  onOpen: (id: string) => void;
  onSeeQueue: () => void;
  onCaptureReasonChange: (reason: string) => void;
  onCaptureReasonCommit: () => void;
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

const MAKE_LABEL = "Make my overview";

const urlPlaceholder = (articleAvailable: boolean, playlistsAvailable: boolean): string => {
  if (articleAvailable) {
    return "Paste a YouTube, podcast or article link";
  }
  return playlistsAvailable ? "Paste a YouTube video or playlist link" : "Paste a YouTube link";
};

const HELD_SAYS = {
  overview: "Already in your library.",
  saved: "Already saved · no overview yet.",
  queued: "Already in your queue.",
} as const;

export const GenerateOverviewForm = ({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
  onPlaylist,
  active = false,
  onReadOverview,
  onOpen,
  onSeeQueue,
  onCaptureReasonChange,
  onCaptureReasonCommit,
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
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!active || !keysReady) {
      return;
    }
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [active, keysReady]);
  const limit = useLimitMessage();
  const next = useNextQuota();
  const usage = useOverviewUsageQuery().data;
  const surface = useSurface();
  const plan = usage?.plan ?? DEFAULT_PLAN;
  const [saving, setSaving] = useState(false);
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
  const social = useSocialLink(url);
  const { startPodcast, transcribeAgain, startTikTok, startSocial, run, justNow, waiting, held, keep } = useNewOverviewRunController();
  const { podcastShown, tiktokShown, socialShown, reading, generateOffered, episodeAction } = pastedLinkState(
    article.link,
    podcast,
    tiktok.link,
    social.link,
  );
  const settleTyping = useTypingSettled(url, () =>
    analytics.capture.newOverviewForm.linkEntered({
      recognised:
        isYouTubeUrl(url) ||
        (article.available && (isArticleLink(url) || isPlatformPodcastLink(url) || isTikTokLink(url) || isSocialLink(url))),
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
      if (usage?.saves !== undefined && usage.saves.used >= usage.saves.limit) {
        analytics.keptLinks.saved.saveCapReached({ plan, captureSurface: captureSurfaceOf(surface) });
      }
      setWallShown(true);
      return;
    }
    if (choosing !== null || limit !== null) {
      return;
    }
    begin(false);
  };

  const begin = (saveInstead: boolean) => {
    startLink(saveInstead);
    if (!saveInstead) {
      onUrlChange("");
    }
  };

  const startLink = (saveInstead: boolean) => {
    if (tiktokShown) {
      const transcribe = transcribeChoiceOf(episodeAction);
      if (tiktok.link.status === "found" && generateOffered && (tiktok.link.words !== null || transcribe !== undefined)) {
        setValidationError(null);
        startTikTok({ video: tiktok.link.video, words: tiktok.link.words, transcribe, from: "dialog", saveInstead });
      }
      return;
    }
    if (socialShown) {
      const transcribe = transcribeChoiceOf(episodeAction);
      const link = social.link;
      if (link.status === "found" && generateOffered && (link.words !== null || link.post.media !== "video" || transcribe !== undefined)) {
        setValidationError(null);
        startSocial({ post: link.post, words: link.words, transcribe, from: "dialog", saveInstead });
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
          saveInstead,
        });
      }
      return;
    }
    if (reading) {
      return;
    }
    if (article.link.status === "found") {
      setValidationError(null);
      startArticle(article.link.article, "dialog", saveInstead);
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
    onSubmit(url, { saveInstead });
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
    if (social.link.status === "found") {
      const { post } = social.link;
      return {
        kicker: `${post.handle === null ? post.authorName : `@${post.handle}`} · ${SOCIAL_PLATFORM_NAME[post.platform]}`,
        title: socialTitle(post),
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
      return null;
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

  const saves = usage?.saves;
  const savesLeft = saves === undefined ? 0 : Math.max(0, saves.limit - saves.used);
  const saveForNow =
    saves === undefined || savesLeft === 0 || walled === null
      ? undefined
      : {
          overviewsBack: String(walled.spent[0]?.limit ?? ""),
          savesLeft,
          savesLimit: saves.limit,
          saving,
          onSave: () => {
            setSaving(true);
            begin(true);
          },
        };

  if (wallShown && run?.saved != null) {
    const saved = run.saved;
    return (
      <SavedForNow
        title={saved.title ?? saved.url}
        kicker={null}
        resetsOn={usage === undefined ? "" : resetDate(usage.resetsOn)}
        overviewsBack={String(usage?.ours.limit ?? "")}
        hasTranscript={saved.source.kind !== "web"}
        onDone={onCancel}
        onReadTranscript={() => onOpen(saved.id)}
      />
    );
  }

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
          save={saveForNow}
        />
        <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
      </>
    );
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit} data-testid={generateOverviewFormTestIds.root}>
      <label className={styles.field}>
        <span className={styles.label}>{article.available ? "Link" : "YouTube link"}</span>
        <span className={styles.fieldRow}>
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
            ref={field}
            autoFocus
            data-testid={generateOverviewFormTestIds.urlInput}
          />
          {choosing === null && (limit === null || walled !== null) && generateOffered && (
            <button
              type="submit"
              className={styles.generateButton}
              disabled={!keysReady || reading}
              data-testid={generateOverviewFormTestIds.generateButton}
            >
              {episodeAction === null ? MAKE_LABEL : createLabelOf(episodeAction, MAKE_LABEL)}
            </button>
          )}
        </span>
      </label>
      {keysReady && limit === null && <UsageLine testIds={generateOverviewFormTestIds.usageLine} offersPlus onPlanFollowed={onCancel} />}
      {held !== null && (
        <p className={styles.held} data-testid={newOverviewDialogTestIds.alreadyHeld}>
          <StrokeIcon name="check" size={15} />
          <span>
            {HELD_SAYS[held.as]}{" "}
            {held.as === "queued" ? (
              <button type="button" className={styles.inlineLink} onClick={onSeeQueue} data-testid={newOverviewDialogTestIds.seeQueueLink}>
                See queue
              </button>
            ) : (
              <button
                type="button"
                className={styles.inlineLink}
                onClick={() => onOpen(held.overviewId)}
                data-testid={newOverviewDialogTestIds.openHeldButton}
              >
                Open it
              </button>
            )}
          </span>
        </p>
      )}

      <PastedLinkStatus
        article={article}
        podcast={podcast}
        tiktok={tiktok}
        social={social}
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

      {limitOrNote()}

      {validationError && (
        <p className={styles.error} data-testid={generateOverviewFormTestIds.validationError}>
          {validationError}
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

      <JustNowList
        runs={justNow}
        current={run}
        waiting={waiting}
        resetsOn={usage === undefined ? null : resetDate(usage.resetsOn)}
        failure={(failed) => (
          <RunErrorMessage
            error={failed.error!}
            className={styles.error}
            testId={generateOverviewFormTestIds.generationError}
            testIds={generateOverviewFormTestIds.runError}
            onFollowed={onCancel}
            episodeSeconds={
              failed.podcast?.durationSeconds ?? failed.tiktok?.durationSeconds ?? failed.social?.post.durationSeconds ?? null
            }
            onTranscribe={transcribeAgain}
            onNotNow={onCancel}
          />
        )}
        onReadOverview={onReadOverview}
        onOpenSaved={(capture) => onOpen(capture.id)}
        onCaptureReasonChange={onCaptureReasonChange}
        onCaptureReasonCommit={onCaptureReasonCommit}
        onKeep={(failed) => void keep(failed)}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel} data-testid={generateOverviewFormTestIds.cancelButton}>
          {justNow.length > 0 || waiting.length > 0 || (run !== null && run.finishedAt === null) ? "Done" : "Cancel"}
        </button>
      </div>
    </form>
  );
};
