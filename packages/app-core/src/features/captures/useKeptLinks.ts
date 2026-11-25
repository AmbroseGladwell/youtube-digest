import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { KeptCapture, OverviewId } from "@overview/domain";
import { useSurface } from "../../app/SurfaceContext.js";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { claimOrSkip } from "../captureQueue/util/claimOrSkip.js";
import { useCaptureClaimApi } from "../captureQueue/useCaptureClaimApi.js";
import { isQueueHoldReason, queueHoldOf, queueProblemOf } from "../captureQueue/util/queueProblemOf.js";
import { SavedWithoutOverview } from "../newOverview/api/SavedWithoutOverview.js";
import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { useNextQuota } from "../newOverview/useNextQuota.js";
import { TranscriptionRefusedError } from "../podcasts/api/TranscriptionRefusedError.js";
import { nextUsageMonth } from "./util/nextUsageMonth.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { usePlan } from "../plus/usePlan.js";
import { captureKeys } from "./captureKeys.js";
import { useKeptLinksQuery } from "./queries/keptLinksQuery.js";
import { captureSurfaceOf } from "./util/captureSurfaceOf.js";
import { keptLinkDue } from "./util/keptLinkDue.js";
import { useKeptLinkMakers } from "./useKeptLinkMakers.js";

const RECHECK_MS = 60_000;
const MINUTE_MS = 60_000;

export interface KeptLinksController {
  links: KeptCapture[];
  making: KeptCapture | null;
  hasExtension: boolean;
  remove: (id: OverviewId) => void;
  retry: (id: OverviewId) => void;
  // Kept for the extension, waiting for the reader's leave to read their site.
  needsAccess: KeptCapture[];
  allow: (link: KeptCapture) => void;
}

// Made by whichever open device can, once: docs/features/kept-links.md, "Kept links".
export interface KeptLinksOptions {
  busy: boolean;
}

export const useKeptLinks = ({ busy }: KeptLinksOptions): KeptLinksController => {
  const { captureStore } = useStores();
  const queryClient = useQueryClient();
  const { apiKeys } = useApiKeys();
  const makers = useKeptLinkMakers(apiKeys);
  const [needsAccess, setNeedsAccess] = useState<ReadonlySet<string>>(new Set());
  const readiness = useGenerationReadiness();
  const hasExtension = useYouTubeFetch() !== null;
  const next = useNextQuota();
  const claimApi = useCaptureClaimApi();
  const holder = useRef(globalThis.crypto.randomUUID()).current;
  const inFlight = useRef(false);
  const links = useKeptLinksQuery().data ?? [];
  const [making, setMaking] = useState<KeptCapture | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [elsewhere, setElsewhere] = useState<ReadonlyMap<string, number>>(new Map());
  const monthSpent = next?.kind === "spent";
  const analytics = useAnalytics();
  const { plan } = usePlan();
  const surface = captureSurfaceOf(useSurface());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: captureKeys.all });
    await queryClient.invalidateQueries({ queryKey: overviewKeys.all });
  }, [queryClient]);

  const makeOne = useCallback(
    async (link: KeptCapture) => {
      if (!(await makers.hasAccess(link))) {
        setNeedsAccess((current) => new Set(current).add(link.id));
        return;
      }
      const claim = await claimOrSkip(claimApi, link.sourceKey, holder);
      if (claim.made === "elsewhere") {
        setElsewhere((current) => new Map(current).set(link.id, claim.until));
        return;
      }
      setMaking(link);
      const attempt = async (saveInstead: boolean) => {
        const options = {
          overviewId: link.id,
          captureReason: () => link.captureReason ?? "",
          ...(saveInstead ? { saveInstead: link.keptFrom } : {}),
        };
        return makers.make(link, options);
      };
      try {
        try {
          await attempt(monthSpent);
        } catch (error) {
          if (!monthSpent && queueProblemOf(error) === "monthSpent") {
            await attempt(true);
            return;
          }
          throw error;
        }
        analytics.keptLinks.queue.keptLinkMade({
          plan,
          captureSurface: surface,
          keptFrom: link.keptFrom,
          waitingFor: link.waitingFor,
          waitedMinutes: Math.max(0, Math.floor((Date.now() - new Date(link.keptAt).getTime()) / MINUTE_MS)),
          byExtension: surface === "panel",
        });
      } catch (error) {
        if (error instanceof SavedWithoutOverview) {
          analytics.keptLinks.saved.savedWithoutOverview({
            plan,
            captureSurface: surface,
            transcribed: link.source?.kind === "podcast",
            fromKeptLink: true,
          });
          return;
        }
        if (error instanceof TranscriptionRefusedError && error.refusal === "not-enough") {
          await captureStore.saveCapture({ ...link, waitingFor: "reset", resumesAt: nextUsageMonth(new Date()).toISOString() });
          return;
        }
        const problem = queueProblemOf(error);
        if (problem === "serverCap" || problem === "serverBusy") {
          const hold = queueHoldOf(error, problem, new Date());
          await captureStore.saveCapture({ ...link, waitingFor: "server", resumesAt: new Date(hold.resumesAt).toISOString() });
          return;
        }
        const failed = isQueueHoldReason(problem) ? "failed" : problem;
        analytics.keptLinks.queue.keptLinkFailed({ plan, captureSurface: surface, problem: failed });
        await captureStore.saveCapture({ ...link, queueStatus: "failed", problem: failed });
      } finally {
        void claimApi?.release(link.sourceKey, holder).catch(() => undefined);
        setMaking(null);
        await refresh();
      }
    },
    [claimApi, holder, makers, monthSpent, captureStore, refresh, analytics, plan, surface],
  );

  // One at a time: the effect can see the same link due again before the first await settles.
  const make = useCallback(
    async (link: KeptCapture) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      try {
        await makeOne(link);
      } finally {
        inFlight.current = false;
      }
    },
    [makeOne],
  );

  const due = links.find(
    (link) => !needsAccess.has(link.id) && (elsewhere.get(link.id) ?? 0) <= now && keptLinkDue(link, { now, hasExtension, monthSpent }),
  );
  const canMake = !busy && making === null && readiness.ready && next?.kind !== "checking";
  useEffect(() => {
    if (canMake && due !== undefined) {
      void make(due);
    }
  }, [canMake, due, make]);

  const remove = useCallback(
    (id: OverviewId) => {
      const link = links.find((candidate) => candidate.id === id);
      if (link !== undefined) {
        analytics.keptLinks.queue.keptLinkRemoved({ plan, captureSurface: surface, waitingFor: link.waitingFor });
      }
      void captureStore.removeCapture(id).then(refresh);
    },
    [links, analytics, plan, surface, captureStore, refresh],
  );
  const retry = useCallback(
    (id: OverviewId) => {
      const link = links.find((candidate) => candidate.id === id);
      if (link !== undefined) {
        void captureStore.saveCapture({ ...link, queueStatus: "waiting", problem: null }).then(refresh);
      }
    },
    [links, captureStore, refresh],
  );

  const allow = useCallback(
    (link: KeptCapture) =>
      void makers.askAccess(link).then((granted) => {
        if (granted) {
          setNeedsAccess(new Set());
        }
      }),
    [makers],
  );

  return { links, making, hasExtension, remove, retry, needsAccess: links.filter((link) => needsAccess.has(link.id)), allow };
};
