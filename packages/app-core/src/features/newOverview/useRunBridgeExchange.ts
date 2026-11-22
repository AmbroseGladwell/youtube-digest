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

// docs/features/injected-button.md, "Three documents, one conversation".
export const useRunBridgeExchange = (controller: NewOverviewRunController): void => {
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

  // Read back, not a dependency: re-subscribing on every tick of a run would drop requests mid-run.
  const currentRun = useRef(run);
  currentRun.current = run;

  useEffect(() => {
    // The press opens the panel before the queries behind `ready` return, so it waits for them.
    if (bridge === null || !readiness.settled) {
      return;
    }

    const restateCurrentRun = () => bridge.report(currentRun.current === null ? null : runReportFor(currentRun.current));

    const act = async (videoUrl: string) => {
      // Checked first: pressing "Overview ready" must open the held note, not buy the video again.
      const held = overviewForVideoUrl(await queryClient.fetchQuery(overviewsWithStateQueryOptions(overviewStore)), videoUrl);
      if (held !== null) {
        analytics.extension.injectedButton.pressed({ outcome: "openedHeld" });
        restateCurrentRun();
        void navigate(Routes.overview(held.id));
        return;
      }

      if (readiness.accountNeeded) {
        analytics.extension.injectedButton.pressed({ outcome: "accountNeeded" });
        restateCurrentRun();
        void navigate(Routes.createAccount());
        return;
      }

      if (!readiness.ready) {
        analytics.extension.injectedButton.pressed({ outcome: "keysNeeded" });
        restateCurrentRun();
        void navigate(Routes.settingsSection("keys"));
        return;
      }

      analytics.extension.injectedButton.pressed({ outcome: "started" });
      start(videoUrl, { from: "injectedButton" });
      void navigate(Routes.home());
    };

    // A request made while the panel was closed is already waiting when it mounts.
    const take = () => {
      const videoUrl = bridge.takeRequest();
      if (videoUrl !== null) {
        void act(videoUrl);
      }
    };

    take();
    return bridge.subscribe(take);
  }, [bridge, readiness, navigate, start, queryClient, overviewStore, analytics]);
};
