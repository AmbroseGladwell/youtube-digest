import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useRunBridge } from "../../app/RunBridgeContext.js";
import { Routes } from "../../app/Routes.js";
import { useStores } from "../../stores/StoresContext.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { overviewsWithStateQueryOptions } from "../overviews/queries/overviewsWithStateQuery.js";
import { overviewForVideoUrl } from "../overviews/util/overviewForVideoUrl.js";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";
import { runReportFor } from "./util/runReportFor.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";

// Both halves of the injected button's conversation, together because they are one
// exchange: the page asks for a run, and every change to the run it asked for goes back
// so the button can paint it (docs/features/injected-button.md).
//
// It lives beside the run rather than on the page the request lands on, because the
// panel can be anywhere when the button is pressed.
export function useRunBridgeExchange(controller: NewOverviewRunController): void {
  const bridge = useRunBridge();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { overviewStore } = useStores();
  const readiness = useGenerationReadiness();
  const analytics = useAnalytics();
  const { run, start } = controller;

  useEffect(() => {
    bridge?.report(run === null ? null : runReportFor(run));
  }, [bridge, run]);

  // Read back rather than taken as a dependency: a request that ends in no new run has
  // to restate what is true, and re-subscribing on every tick of a running one would
  // drop requests arriving mid-run.
  const currentRun = useRef(run);
  currentRun.current = run;

  useEffect(() => {
    if (bridge === null) {
      return;
    }

    const restateCurrentRun = () =>
      bridge.report(currentRun.current === null ? null : runReportFor(currentRun.current));

    const act = async (videoUrl: string) => {
      // Asked before anything is started, because the button says "Overview ready" on a
      // video the library already holds and pressing it must read that note rather than
      // buy the video a second time (docs/features/injected-button.md).
      const held = overviewForVideoUrl(
        await queryClient.fetchQuery(overviewsWithStateQueryOptions(overviewStore)),
        videoUrl,
      );
      if (held !== null) {
        analytics.extension.injectedButton.pressed({ outcome: "openedHeld" });
        restateCurrentRun();
        void navigate(Routes.overview(held.id));
        return;
      }

      if (readiness !== "ready") {
        analytics.extension.injectedButton.pressed({ outcome: "keysNeeded" });
        restateCurrentRun();
        void navigate(Routes.settingsSection("keys"));
        return;
      }

      analytics.extension.injectedButton.pressed({ outcome: "started" });
      start(videoUrl, { from: "injectedButton" });
      void navigate(Routes.home());
    };

    // A request made while the panel was closed is waiting by the time it mounts, so the
    // first read is immediate rather than left to the next notification.
    const take = () => {
      const videoUrl = bridge.takeRequest();
      if (videoUrl !== null) {
        void act(videoUrl);
      }
    };

    take();
    return bridge.subscribe(take);
  }, [bridge, readiness, navigate, start, queryClient, overviewStore, analytics]);
}
