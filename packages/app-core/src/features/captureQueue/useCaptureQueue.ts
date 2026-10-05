import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueuedCapture, VideoId } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import type { NewOverviewRun } from "../newOverview/types/NewOverviewRun.js";
import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { generationRunStatus } from "../newOverview/util/generationRunStatus.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { transcriptKeys } from "../transcripts/transcriptKeys.js";
import { playlistKeys } from "../playlists/playlistKeys.js";
import { useFollowedPlaylistsQuery } from "../playlists/queries/followedPlaylistsQuery.js";
import { usePlaylistApi } from "../playlists/usePlaylistApi.js";
import { capturesFor } from "../playlists/util/capturesFor.js";
import { knownVideoIds, libraryVideoIds } from "../playlists/util/knownVideoIds.js";
import { newPlaylistEntries } from "../playlists/util/newPlaylistEntries.js";
import { captureQueueKeys } from "./captureQueueKeys.js";
import { readCaptureQueuePreferences, writeCaptureQueuePreferences } from "./captureQueuePreferencesStorage.js";
import { useCaptureQueueQuery } from "./queries/captureQueueQuery.js";
import type { CaptureQueueStrip } from "./types/CaptureQueueStrip.js";
import { captureQueueStrip, type QueueNotice } from "./util/captureQueueStrip.js";
import { makingStep } from "./util/makingStep.js";
import { queueProblemOf } from "./util/queueProblemOf.js";

const CHECKED_NOTICE_MS = 8_000;
const DONE_NOTICE_MS = 10_000;

export interface QueueMaking {
  capture: QueuedCapture;
  run: NewOverviewRun;
}

export interface CaptureQueueController {
  // Whether this shell can follow playlists at all; without a server nothing is offered.
  available: boolean;
  waiting: QueuedCapture[];
  attention: QueuedCapture[];
  making: QueueMaking | null;
  strip: CaptureQueueStrip | null;
  paused: boolean;
  folded: boolean;
  needsKey: boolean;
  setPaused: (paused: boolean) => void;
  setFolded: (folded: boolean) => void;
  remove: (videoId: VideoId) => void;
  retry: (videoId: VideoId) => void;
  dismiss: (videoId: VideoId) => void;
  clear: () => Promise<number>;
  dismissStrip: () => void;
}

// The queue on this device: on opening it checks every followed playlist for what is new,
// then makes what waits one video at a time, oldest first, while the app is open. A run the
// reader starts goes first (docs/features/capture-queue.md). Owned by the AppShell, like the
// reader's own run, so it outlives every navigation.
export function useCaptureQueue({ readerRunActive }: { readerRunActive: boolean }): CaptureQueueController {
  const { overviewStore, followedPlaylistStore, captureQueueStore } = useStores();
  const accountId = useLibraryAccountId();
  const queryClient = useQueryClient();
  const reporter = useErrorReporter();
  const playlistApi = usePlaylistApi();
  const { apiKeys } = useApiKeys();
  const generate = useRunOverviewGeneration(apiKeys);
  const needsKey = useGenerationReadiness() !== "ready";
  const queue = useCaptureQueueQuery();
  const followed = useFollowedPlaylistsQuery();

  const [preferences, setPreferences] = useState(() => readCaptureQueuePreferences(accountId));
  const [making, setMaking] = useState<QueueMaking | null>(null);
  const [batch, setBatch] = useState<{ done: number } | null>(null);
  const [notice, setNotice] = useState<QueueNotice | null>(null);
  const [attentionDismissed, setAttentionDismissed] = useState(false);
  const cancelled = useRef<VideoId | null>(null);
  const checked = useRef<{ library: string; playlists: Set<string> }>({ library: "", playlists: new Set() });

  useEffect(() => setPreferences(readCaptureQueuePreferences(accountId)), [accountId]);

  const items = queue.data ?? [];
  const waiting = items.filter((capture) => capture.status === "waiting");
  const attention = items.filter((capture) => capture.status !== "waiting");

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
  }, [queryClient]);

  const savePreferences = useCallback(
    (patch: Partial<typeof preferences>) =>
      setPreferences((current) => {
        const next = { ...current, ...patch };
        writeCaptureQueuePreferences(accountId, next);
        return next;
      }),
    [accountId],
  );

  // Checking on opening (docs/features/playlists.md, "Checking on opening").
  // Each followed playlist once per opening, including one another device follows that
  // arrives with a pull after the app opened.
  const libraryKey = `${accountId ?? ""}|${playlistApi?.apiUrl ?? ""}`;
  useEffect(() => {
    if (playlistApi === null || !followed.isSuccess) return;
    if (checked.current.library !== libraryKey) checked.current = { library: libraryKey, playlists: new Set() };
    const playlists = followed.data
      .map(({ playlist }) => playlist)
      .filter((playlist) => !checked.current.playlists.has(playlist.id));
    if (playlists.length === 0) return;
    for (const playlist of playlists) checked.current.playlists.add(playlist.id);

    void (async () => {
      let queued = 0;
      for (const playlist of playlists) {
        try {
          const lookup = await playlistApi.api.lookup(playlist.id);
          const [check, known] = await Promise.all([
            followedPlaylistStore.getCheck(playlist.id),
            knownVideoIds(overviewStore, captureQueueStore),
          ]);
          const { fresh, seen } = newPlaylistEntries(lookup, playlist, check, known);
          const captures = capturesFor(fresh, { id: lookup.id, title: lookup.title }, new Date());
          await captureQueueStore.enqueue(captures);
          queued += captures.filter((capture) => capture.status === "waiting").length;
          await followedPlaylistStore.saveCheck({ playlistId: playlist.id, seenVideoIds: seen, checkedAt: new Date().toISOString() });
          const changed =
            playlist.unavailable !== null ||
            playlist.title !== lookup.title ||
            playlist.owner !== lookup.owner ||
            playlist.privacy !== lookup.privacy;
          if (changed) {
            await followedPlaylistStore.saveFollowed({
              ...playlist,
              title: lookup.title,
              owner: lookup.owner,
              privacy: lookup.privacy,
              unavailable: null,
            });
          }
        } catch (error) {
          const code = isSyncRequestError(error) ? error.code : null;
          const unavailable = code === "playlist_private" ? "private" : code === "playlist_not_found" ? "gone" : null;
          if (unavailable !== null && playlist.unavailable !== unavailable) {
            await followedPlaylistStore.saveFollowed({ ...playlist, unavailable });
          }
          reporter.warn({
            name: "playlistCheckFailed",
            outcome: unavailable ?? "failed",
            ...(isSyncRequestError(error) && error.requestId !== undefined ? { requestId: error.requestId } : {}),
            ...(code === null ? {} : { apiErrorCode: code }),
          });
        }
      }
      void queryClient.invalidateQueries({ queryKey: playlistKeys.followed() });
      refresh();
      if (queued > 0) setNotice({ kind: "checked", playlists: playlists.length, queued });
    })();
  }, [playlistApi, followed.isSuccess, followed.data, libraryKey, followedPlaylistStore, overviewStore, captureQueueStore, queryClient, refresh, reporter]);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), notice.kind === "checked" ? CHECKED_NOTICE_MS : DONE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const make = useCallback(
    async (capture: QueuedCapture) => {
      if ((await libraryVideoIds(overviewStore)).has(capture.videoId)) {
        await captureQueueStore.removeQueued(capture.videoId);
        await queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
        return;
      }
      cancelled.current = null;
      setAttentionDismissed(false);
      setBatch((current) => current ?? { done: 0 });
      const run: NewOverviewRun = {
        url: capture.url,
        startedAt: Date.now(),
        finishedAt: null,
        video: null,
        transcriptWords: null,
        overview: null,
        error: null,
        captureReason: "",
      };
      setMaking({ capture, run });
      try {
        await generate(capture.url, {
          fromPlaylist: capture.fromPlaylist,
          isCancelled: () => cancelled.current === capture.videoId,
          onProgress: (progress) =>
            setMaking((current) =>
              current?.capture.videoId === capture.videoId ? { ...current, run: { ...current.run, ...progress } } : current,
            ),
        });
        await captureQueueStore.removeQueued(capture.videoId);
        setBatch((current) => ({ done: (current?.done ?? 0) + 1 }));
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
      } catch (error) {
        if (!(error instanceof GenerationCancelledError)) {
          const problem = queueProblemOf(error);
          await captureQueueStore.saveQueued({ ...capture, status: "failed", problem });
          reporter.warn({ name: "queuedCaptureFailed", problem });
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
        setMaking(null);
      }
    },
    [overviewStore, captureQueueStore, generate, queryClient, refresh, reporter],
  );

  const next = waiting[0] ?? null;
  const canMake = !preferences.paused && !needsKey && !readerRunActive && making === null && queue.isSuccess;
  useEffect(() => {
    if (canMake && next !== null) void make(next);
  }, [canMake, next, make]);

  // A finished batch says so once, then the next one counts from one again. One that left
  // problems keeps saying so until the reader dismisses it.
  const finished = batch !== null && making === null && waiting.length === 0;
  useEffect(() => {
    if (!finished || attention.length > 0) return;
    setNotice({ kind: "done", made: batch.done });
    setBatch(null);
  }, [finished, attention.length, batch]);

  const setPaused = useCallback(
    (paused: boolean) => {
      if (paused && making !== null) cancelled.current = making.capture.videoId;
      savePreferences({ paused });
    },
    [making, savePreferences],
  );

  const remove = useCallback(
    (videoId: VideoId) => {
      if (making?.capture.videoId === videoId) cancelled.current = videoId;
      void captureQueueStore.removeQueued(videoId).then(refresh);
    },
    [making, captureQueueStore, refresh],
  );

  const retry = useCallback(
    (videoId: VideoId) => {
      const capture = items.find((each) => each.videoId === videoId);
      if (capture === undefined) return;
      void captureQueueStore
        .saveQueued({ ...capture, status: "waiting", problem: null, queuedAt: new Date().toISOString() })
        .then(refresh);
    },
    [items, captureQueueStore, refresh],
  );

  const clear = useCallback(async () => {
    const removed = waiting.length;
    if (making !== null) cancelled.current = making.capture.videoId;
    await captureQueueStore.removeWaiting();
    refresh();
    return removed;
  }, [waiting.length, making, captureQueueStore, refresh]);

  const failed = attention.filter((capture) => capture.status === "failed").length;
  const strip = captureQueueStrip({
    making:
      making === null
        ? null
        : {
            title: making.capture.title,
            step: makingStep(making.run, false).step,
            stepProgress: generationRunStatus(making.run).progressFraction,
          },
    waiting: making === null ? waiting.length : waiting.filter((capture) => capture.videoId !== making.capture.videoId).length,
    failed,
    skipped: attention.length - failed,
    paused: preferences.paused,
    needsKey,
    batch,
    notice,
    attentionDismissed,
  });

  return useMemo(
    () => ({
      available: playlistApi !== null,
      waiting,
      attention,
      making,
      strip,
      paused: preferences.paused,
      folded: preferences.folded,
      needsKey,
      setPaused,
      setFolded: (folded: boolean) => savePreferences({ folded }),
      remove,
      retry,
      dismiss: (videoId: VideoId) => void captureQueueStore.removeQueued(videoId).then(refresh),
      clear,
      dismissStrip: () => {
        setAttentionDismissed(true);
        setNotice(null);
        if (waiting.length === 0) setBatch(null);
      },
    }),
    [playlistApi, waiting, attention, making, strip, preferences, needsKey, setPaused, savePreferences, remove, retry, captureQueueStore, refresh, clear],
  );
}
