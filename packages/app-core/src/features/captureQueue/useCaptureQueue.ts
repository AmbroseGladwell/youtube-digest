import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaylistId, PlaylistPace, QueuedCapture, VideoId } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { providersWithKeys } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import type { NewOverviewRun } from "../newOverview/types/NewOverviewRun.js";
import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { generationKeys } from "../newOverview/generationKeys.js";
import { useOverviewUsageQuery } from "../newOverview/queries/overviewUsageQuery.js";
import { useLimitMessage } from "../newOverview/useLimitMessage.js";
import { useNextQuota } from "../newOverview/useNextQuota.js";
import type { LimitMessage } from "../newOverview/util/limitMessage.js";
import { monthResetOf } from "../newOverview/util/monthReset.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { generationRunStatus } from "../newOverview/util/generationRunStatus.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";
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
import type { QueueHold } from "./types/QueueHold.js";
import { captureQueueStrip, type QueueNotice } from "./util/captureQueueStrip.js";
import { localDayKey, madeTodayByPlaylist, nextLocalMidnight } from "./util/madeTodayByPlaylist.js";
import { makingStep } from "./util/makingStep.js";
import { pacedQueue } from "./util/pacedQueue.js";
import { isQueueHoldReason, queueHoldOf, queueProblemOf } from "./util/queueProblemOf.js";

const CHECKED_NOTICE_MS = 8_000;

type ResumedVia = "reset" | "extension" | "key" | "plan";
const DONE_NOTICE_MS = 10_000;

export interface QueueMaking {
  capture: QueuedCapture;
  run: NewOverviewRun;
}

export interface CaptureQueueController {
  // Whether this shell can follow playlists at all; without a server nothing is offered.
  available: boolean;
  // Every video still waiting, and the same videos sorted by their playlists' paces: what
  // can be made now, what continues tomorrow, and what waits for the reader to choose it
  // (docs/features/capture-queue.md, "Waiting on a pace").
  waiting: QueuedCapture[];
  ready: QueuedCapture[];
  tomorrow: QueuedCapture[];
  forYou: QueuedCapture[];
  paceOf: (playlistId: PlaylistId) => PlaylistPace;
  madeToday: (playlistId: PlaylistId) => number;
  attention: QueuedCapture[];
  making: QueueMaking | null;
  strip: CaptureQueueStrip | null;
  paused: boolean;
  folded: boolean;
  needsKey: boolean;
  // Waiting at a limit, until it resets or the extension connects; nothing is asked meanwhile
  // (docs/features/capture-queue.md, "Waiting at a limit"). The month's limit wins over the
  // others, and over every pace.
  hold: QueueHold | null;
  // What ran out, when the queue waits for the month: the ways round it the strip and the
  // page offer.
  limit: LimitMessage | null;
  // Whether the extension would be a way around a hold here: a shell with no free rung.
  viaExtension: boolean;
  setPaused: (paused: boolean) => void;
  setFolded: (folded: boolean) => void;
  remove: (videoId: VideoId) => void;
  // Made next, past their playlist's pace, which stays as it is.
  makeNow: (videoIds: readonly VideoId[]) => Promise<void>;
  removeMany: (videoIds: readonly VideoId[]) => Promise<void>;
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
  const readiness = useGenerationReadiness();
  const accountNeeded = readiness.accountNeeded;
  const needsKey = !readiness.ready && !accountNeeded;
  const nextQuota = useNextQuota();
  const limit = useLimitMessage();
  const plan = useOverviewUsageQuery().data?.plan ?? null;
  const onlyMyKey = useSettingsQuery().data?.onlyMyKey ?? false;
  const youTubeFetch = useYouTubeFetch();
  const queue = useCaptureQueueQuery();
  const followed = useFollowedPlaylistsQuery();
  const overviews = useOverviewsWithStateQuery();

  const [preferences, setPreferences] = useState(() => readCaptureQueuePreferences(accountId));
  const [making, setMaking] = useState<QueueMaking | null>(null);
  const [batch, setBatch] = useState<{ done: number } | null>(null);
  const [notice, setNotice] = useState<QueueNotice | null>(null);
  const [attentionDismissed, setAttentionDismissed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const holding = useRef<QueueHold | null>(null);
  const cancelled = useRef<VideoId | null>(null);
  const waitingCount = useRef(0);
  const checked = useRef<{ library: string; playlists: Set<string> }>({ library: "", playlists: new Set() });

  useEffect(() => setPreferences(readCaptureQueuePreferences(accountId)), [accountId]);

  const items = queue.data ?? [];
  const waiting = items.filter((capture) => capture.status === "waiting");
  const attention = items.filter((capture) => capture.status !== "waiting");
  waitingCount.current = waiting.length;
  const counted = nextQuota?.kind === "spent" ? nextQuota.resetsOn : null;
  const monthHold = useMemo<QueueHold | null>(
    () => (counted === null ? null : { reason: "monthSpent", resumesAt: monthResetOf(counted, new Date()).getTime() }),
    [counted],
  );
  const hold = monthHold ?? preferences.hold;
  holding.current = preferences.hold;

  // A pace starts again at the reader's midnight, whether or not anything else changes.
  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), nextLocalMidnight(now).getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [now]);
  const today = localDayKey(now);
  const chosenToday = useMemo(
    () => new Set(preferences.chosenToday?.day === today ? preferences.chosenToday.videoIds : []),
    [preferences.chosenToday, today],
  );
  const paces = useMemo(
    () => new Map<string, PlaylistPace>((followed.data ?? []).map(({ playlist }) => [playlist.id, playlist.pace])),
    [followed.data],
  );
  const madeTodayCounts = useMemo(
    () => madeTodayByPlaylist(readableEntries(overviews.data ?? []).map(({ overview }) => overview), chosenToday, now),
    [overviews.data, chosenToday, now],
  );
  const paceOf = useCallback((playlistId: PlaylistId) => paces.get(playlistId) ?? "asTheyCome", [paces]);
  const madeToday = useCallback((playlistId: PlaylistId) => madeTodayCounts.get(playlistId) ?? 0, [madeTodayCounts]);
  const paced = pacedQueue(
    waiting,
    (capture) => paceOf(capture.fromPlaylist.id),
    (capture) => madeToday(capture.fromPlaylist.id),
  );

  // Said once a day for each playlist that has made all its pace allows, while the rest of
  // the queue carries on.
  const reachedPace = useRef(new Set<string>());
  const stillMaking = new Set(paced.ready.map((capture) => capture.fromPlaylist.id));
  const pacedPlaylists = [...new Set(paced.tomorrow.map((capture) => capture.fromPlaylist.id))]
    .filter((playlistId) => !stillMaking.has(playlistId))
    .join(" ");
  useEffect(() => {
    for (const playlistId of pacedPlaylists === "" ? [] : (pacedPlaylists.split(" ") as PlaylistId[])) {
      const reached = `${today} ${playlistId}`;
      if (reachedPace.current.has(reached)) continue;
      reachedPace.current.add(reached);
      reporter.warn({
        name: "captureQueuePaced",
        pace: paceOf(playlistId),
        madeToday: madeToday(playlistId),
        waiting: paced.tomorrow.filter((capture) => capture.fromPlaylist.id === playlistId).length,
      });
    }
  }, [pacedPlaylists, today]);

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
        if (capture.chosenAt !== null) {
          setPreferences((current) => {
            const day = localDayKey(new Date());
            const chosen = current.chosenToday?.day === day ? current.chosenToday.videoIds : [];
            const next = { ...current, chosenToday: { day, videoIds: [...chosen, capture.videoId] } };
            writeCaptureQueuePreferences(accountId, next);
            return next;
          });
        }
        await captureQueueStore.removeQueued(capture.videoId);
        setBatch((current) => ({ done: (current?.done ?? 0) + 1 }));
        await queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
      } catch (error) {
        if (error instanceof GenerationCancelledError) return;
        const problem = queueProblemOf(error);
        if (isQueueHoldReason(problem)) {
          const held = queueHoldOf(error, problem, new Date());
          holding.current = held;
          savePreferences({ hold: held });
        } else {
          await captureQueueStore.saveQueued({ ...capture, status: "failed", problem });
          reporter.warn({ name: "queuedCaptureFailed", problem });
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
        setMaking(null);
      }
    },
    [overviewStore, captureQueueStore, generate, queryClient, refresh, reporter, savePreferences, accountId],
  );

  const resumedVia = useRef<ResumedVia>("reset");
  const resume = useCallback(
    (via: ResumedVia) => {
      if (holding.current === null) return;
      holding.current = null;
      resumedVia.current = via;
      savePreferences({ hold: null });
    },
    [savePreferences],
  );

  // At the month's limit the queue carries on when a key or a plan gives it room, and asks
  // for the counts again as the month turns.
  const keyed = `${providersWithKeys(apiKeys).join(",")}|${onlyMyKey}`;
  const lastKeyed = useRef(keyed);
  const lastPlan = useRef(plan);
  useEffect(() => {
    const via = keyed !== lastKeyed.current ? "key" : lastPlan.current !== null && plan !== lastPlan.current ? "plan" : null;
    lastKeyed.current = keyed;
    lastPlan.current = plan;
    if (via === null) return;
    resumedVia.current = via;
    if (preferences.hold?.reason === "monthSpent") resume(via);
  }, [keyed, plan]);
  // Each wait is logged once as it begins and once as it ends, whichever way it was learned:
  // from a refusal, or from the month's counts (docs/features/capture-queue.md, "Waiting at a
  // limit").
  const loggedHold = useRef<QueueHold | null>(null);
  useEffect(() => {
    const previous = loggedHold.current;
    if (previous?.reason === hold?.reason) return;
    loggedHold.current = hold;
    if (previous !== null) {
      reporter.warn({ name: "captureQueueResumed", reason: previous.reason, waiting: waitingCount.current, via: resumedVia.current });
      resumedVia.current = "reset";
    }
    if (hold !== null) {
      resumedVia.current = "reset";
      reporter.warn({
        name: "captureQueueHeld",
        reason: hold.reason,
        waiting: waitingCount.current,
        resumesInSeconds: Math.max(0, Math.ceil((hold.resumesAt - Date.now()) / 1000)),
      });
    }
  }, [hold, reporter]);

  useEffect(() => {
    if (monthHold === null) return;
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: generationKeys.allUsage() }),
      Math.max(0, monthHold.resumesAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [monthHold, queryClient]);

  // The hold ends by itself when the limit resets, or at once when an extension connects and
  // can fetch instead; a shell that always had one is not a connection.
  const persistedHold = preferences.hold;
  useEffect(() => {
    if (persistedHold === null) return;
    const timer = setTimeout(() => resume("reset"), Math.max(0, persistedHold.resumesAt - Date.now()));
    return () => clearTimeout(timer);
  }, [persistedHold, resume]);
  const hadYouTubeFetch = useRef(youTubeFetch !== null);
  useEffect(() => {
    const has = youTubeFetch !== null;
    if (has && !hadYouTubeFetch.current) resume("extension");
    hadYouTubeFetch.current = has;
  }, [youTubeFetch, resume]);

  const next = paced.ready[0] ?? null;
  // Nothing is made until the month's counts are known, so a queue opened at the limit never
  // asks before it knows; a server that can't be asked still enforces the limit itself.
  const countsKnown = nextQuota?.kind !== "checking";
  const canMake =
    !preferences.paused &&
    !needsKey &&
    !accountNeeded &&
    !readerRunActive &&
    making === null &&
    hold === null &&
    countsKnown &&
    queue.isSuccess &&
    followed.isSuccess;
  useEffect(() => {
    if (canMake && next !== null) void make(next);
  }, [canMake, next, make]);

  // A finished batch says so once, then the next one counts from one again. One that left
  // problems keeps saying so until the reader dismisses it.
  const finished = batch !== null && making === null && paced.ready.length === 0;
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

  // Its place in the oldest-first order is kept, so a video the reader tries again runs next
  // rather than after everything already waiting (docs/features/capture-queue.md).
  const retry = useCallback(
    (videoId: VideoId) => {
      const capture = items.find((each) => each.videoId === videoId);
      if (capture === undefined) return;
      void captureQueueStore.saveQueued({ ...capture, status: "waiting", problem: null }).then(refresh);
    },
    [items, captureQueueStore, refresh],
  );

  const makeNow = useCallback(
    async (videoIds: readonly VideoId[]) => {
      const chosenAt = new Date().toISOString();
      const chosen = new Set<string>(videoIds);
      for (const capture of items) {
        if (chosen.has(capture.videoId) && capture.status === "waiting") await captureQueueStore.saveQueued({ ...capture, chosenAt });
      }
      refresh();
    },
    [items, captureQueueStore, refresh],
  );

  const removeMany = useCallback(
    async (videoIds: readonly VideoId[]) => {
      if (making !== null && videoIds.includes(making.capture.videoId)) cancelled.current = making.capture.videoId;
      for (const videoId of videoIds) await captureQueueStore.removeQueued(videoId);
      refresh();
    },
    [making, captureQueueStore, refresh],
  );

  const clear = useCallback(async () => {
    const removed = waiting.length;
    if (making !== null) cancelled.current = making.capture.videoId;
    await captureQueueStore.removeWaiting();
    refresh();
    return removed;
  }, [waiting.length, making, captureQueueStore, refresh]);

  const failed = attention.filter((capture) => capture.status === "failed").length;
  const notMaking = (captures: QueuedCapture[]) =>
    making === null ? captures : captures.filter((capture) => capture.videoId !== making.capture.videoId);
  const strip = accountNeeded ? null : captureQueueStrip({
    making:
      making === null
        ? null
        : {
            title: making.capture.title,
            step: makingStep(making.run, false).step,
            stepProgress: generationRunStatus(making.run).progressFraction,
          },
    waiting: notMaking(waiting).length,
    ready: notMaking(paced.ready).length,
    tomorrow: paced.tomorrow.length,
    forYou: {
      waiting: paced.forYou.length,
      playlists: [...new Set(paced.forYou.map((capture) => capture.fromPlaylist.title))],
    },
    failed,
    skipped: attention.length - failed,
    paused: preferences.paused,
    needsKey,
    hold,
    limit,
    viaExtension: youTubeFetch === null,
    batch,
    notice,
    attentionDismissed,
  });

  return useMemo(
    () => ({
      available: playlistApi !== null,
      waiting,
      ready: paced.ready,
      tomorrow: paced.tomorrow,
      forYou: paced.forYou,
      paceOf,
      madeToday,
      attention,
      making,
      strip,
      paused: preferences.paused,
      folded: preferences.folded,
      needsKey,
      hold,
      limit,
      viaExtension: youTubeFetch === null,
      setPaused,
      setFolded: (folded: boolean) => savePreferences({ folded }),
      remove,
      makeNow,
      removeMany,
      retry,
      dismiss: (videoId: VideoId) => void captureQueueStore.removeQueued(videoId).then(refresh),
      clear,
      dismissStrip: () => {
        setAttentionDismissed(true);
        setNotice(null);
        if (waiting.length === 0) setBatch(null);
      },
    }),
    [
      playlistApi,
      waiting,
      paced.ready,
      paced.tomorrow,
      paced.forYou,
      paceOf,
      madeToday,
      attention,
      making,
      strip,
      preferences,
      needsKey,
      hold,
      limit,
      youTubeFetch,
      setPaused,
      savePreferences,
      remove,
      makeNow,
      removeMany,
      retry,
      captureQueueStore,
      refresh,
      clear,
    ],
  );
}
