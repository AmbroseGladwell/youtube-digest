import { useCallback } from "react";
import { createFetchGenerationApi } from "@overview/sync";
import { Routes } from "../../app/Routes.js";
import { useStores } from "../../stores/StoresContext.js";
import { useNewOverviewRunController } from "../newOverview/NewOverviewRunContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { savedFromShare } from "./util/savedFromShare.js";
import { forgetSharedPageIntent, readSharedPageIntent } from "./util/sharedPageIntent.js";

// Finishing what the visitor started before they were asked to make an account: the copy
// they wanted to keep goes into the library they now have, and the link they pasted starts
// generating (design 30l). Always forgets the intent first, so a failure cannot leave one
// to fire again on the next sign-in (docs/features/sharing.md). The share's token goes to the
// server before the copy is saved, so its push is let in uncounted rather than reserving a
// slot on the reader's month (docs/architecture/tiers.md, "Reserving on the reader's own key").
export function useSharedPageIntent(): () => Promise<string> {
  const { overviewStore } = useStores();
  const newOverview = useNewOverviewRunController();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

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
    if (apiUrl !== null) {
      await createFetchGenerationApi({ baseUrl: apiUrl, token: connection.token })
        .reserve(overview.id, intent.token)
        .catch(() => undefined);
    }
    await overviewStore.saveOverview(overview);
    return Routes.overview(overview.id);
  }, [overviewStore, newOverview, apiUrl, connection.token]);
}
