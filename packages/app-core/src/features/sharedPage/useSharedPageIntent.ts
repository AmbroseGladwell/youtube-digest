import { useCallback } from "react";
import { Routes } from "../../app/Routes.js";
import { useStores } from "../../stores/StoresContext.js";
import { useNewOverviewRunController } from "../newOverview/NewOverviewRunContext.js";
import { savedFromShare } from "./util/savedFromShare.js";
import { forgetSharedPageIntent, readSharedPageIntent } from "./util/sharedPageIntent.js";

// Finishing what the visitor started before they were asked to make an account: the copy
// they wanted to keep goes into the library they now have, and the link they pasted starts
// generating (design 30l). Always forgets the intent first, so a failure cannot leave one
// to fire again on the next sign-in (docs/features/sharing.md).
export function useSharedPageIntent(): () => Promise<string> {
  const { overviewStore } = useStores();
  const newOverview = useNewOverviewRunController();

  return useCallback(async () => {
    const intent = readSharedPageIntent();
    forgetSharedPageIntent();
    if (intent === null) {
      return Routes.home();
    }
    if (intent.kind === "generate") {
      newOverview.start(intent.videoUrl, { from: "sharedPage" });
      return Routes.home();
    }
    const overview = savedFromShare(intent.snapshot.note);
    await overviewStore.saveOverview(overview);
    return Routes.overview(overview.id);
  }, [overviewStore, newOverview]);
}
