import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { KeptCapture, OverviewId } from "@overview/domain";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { claimOrSkip } from "../captureQueue/util/claimOrSkip.js";
import { useCaptureClaimApi } from "../captureQueue/useCaptureClaimApi.js";
import { isQueueHoldReason, queueHoldOf, queueProblemOf } from "../captureQueue/util/queueProblemOf.js";
import { SavedWithoutOverview } from "../newOverview/api/SavedWithoutOverview.js";
import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { useNextQuota } from "../newOverview/useNextQuota.js";
import { useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { captureKeys } from "./captureKeys.js";
import { useKeptLinksQuery } from "./queries/keptLinksQuery.js";
import { keptLinkDue } from "./util/keptLinkDue.js";

const RECHECK_MS = 60_000;

export interface KeptLinksController {
  links: KeptCapture[];
  making: KeptCapture | null;
  hasExtension: boolean;
  remove: (id: OverviewId) => void;
  retry: (id: OverviewId) => void;
}

// Made by whichever open device can, once: docs/features/kept-links.md, "Kept links".
export interface KeptLinksOptions {
  busy: boolean;
}

export const useKeptLinks = ({ busy }: KeptLinksOptions): KeptLinksController => {
  const { captureStore } = useStores();
  const queryClient = useQueryClient();
  const { apiKeys } = useApiKeys();
  const generate = useRunOverviewGeneration(apiKeys);
  const readiness = useGenerationReadiness();
  const hasExtension = useYouTubeFetch() !== null;
  const next = useNextQuota();
  const claimApi = useCaptureClaimApi();
  const holder = useRef(globalThis.crypto.randomUUID()).current;
  const links = useKeptLinksQuery().data ?? [];
  const [making, setMaking] = useState<KeptCapture | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [elsewhere, setElsewhere] = useState<ReadonlyMap<string, number>>(new Map());
  const monthSpent = next?.kind === "spent";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: captureKeys.all });
    await queryClient.invalidateQueries({ queryKey: overviewKeys.all });
  }, [queryClient]);

  const make = useCallback(
    async (link: KeptCapture) => {
      const claim = await claimOrSkip(claimApi, link.sourceKey, holder);
      if (claim.made === "elsewhere") {
        setElsewhere((current) => new Map(current).set(link.id, claim.until));
        return;
      }
      setMaking(link);
      const attempt = (saveInstead: boolean) =>
        generate(link.url, {
          overviewId: link.id,
          captureReason: () => link.captureReason ?? "",
          ...(saveInstead ? { saveInstead: link.keptFrom } : {}),
        });
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
      } catch (error) {
        if (error instanceof SavedWithoutOverview) {
          return;
        }
        const problem = queueProblemOf(error);
        if (problem === "serverCap" || problem === "serverBusy") {
          const hold = queueHoldOf(error, problem, new Date());
          await captureStore.saveCapture({ ...link, waitingFor: "server", resumesAt: new Date(hold.resumesAt).toISOString() });
          return;
        }
        await captureStore.saveCapture({ ...link, queueStatus: "failed", problem: isQueueHoldReason(problem) ? "failed" : problem });
      } finally {
        void claimApi?.release(link.sourceKey, holder).catch(() => undefined);
        setMaking(null);
        await refresh();
      }
    },
    [claimApi, holder, generate, monthSpent, captureStore, refresh],
  );

  const due = links.find((link) => (elsewhere.get(link.id) ?? 0) <= now && keptLinkDue(link, { now, hasExtension, monthSpent }));
  const canMake = !busy && making === null && readiness.ready && next?.kind !== "checking";
  useEffect(() => {
    if (canMake && due !== undefined) {
      void make(due);
    }
  }, [canMake, due, make]);

  const remove = useCallback((id: OverviewId) => void captureStore.removeCapture(id).then(refresh), [captureStore, refresh]);
  const retry = useCallback(
    (id: OverviewId) => {
      const link = links.find((candidate) => candidate.id === id);
      if (link !== undefined) {
        void captureStore.saveCapture({ ...link, queueStatus: "waiting", problem: null }).then(refresh);
      }
    },
    [links, captureStore, refresh],
  );

  return { links, making, hasExtension, remove, retry };
};
