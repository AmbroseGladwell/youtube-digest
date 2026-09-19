import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useRunBridge } from "../../app/RunBridgeContext.js";
import { Routes } from "../../app/Routes.js";
import { hasRequiredApiKeys } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";
import { runReportFor } from "./util/runReportFor.js";

// Both halves of the injected button's conversation, together because they are one
// exchange: the page asks for a run, and every change to the run it asked for goes back
// so the button can paint it (docs/features/injected-button.md).
//
// It lives beside the run rather than on the page the request lands on, because the
// panel can be anywhere when the button is pressed.
export function useRunBridgeExchange(controller: NewOverviewRunController): void {
  const bridge = useRunBridge();
  const navigate = useNavigate();
  const { apiKeys } = useApiKeys();
  const { run, start } = controller;

  useEffect(() => {
    bridge?.report(run === null ? null : runReportFor(run));
  }, [bridge, run]);

  useEffect(() => {
    if (bridge === null) {
      return;
    }

    // A request made while the panel was closed is waiting by the time it mounts, so the
    // first read is immediate rather than left to the next notification.
    const take = () => {
      const videoUrl = bridge.takeRequest();
      if (videoUrl === null) {
        return;
      }
      if (!hasRequiredApiKeys(apiKeys)) {
        void navigate(Routes.settings());
        return;
      }
      start(videoUrl);
      void navigate(Routes.home());
    };

    take();
    return bridge.subscribe(take);
  }, [bridge, apiKeys, navigate, start]);
}
