import { useCallback } from "react";
import { createFetchGenerationApi } from "@overview/sync";
import type { Overview, SharedOverview, ShareToken } from "@overview/domain";
import { useStores } from "../../stores/StoresContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { savedFromShare } from "./util/savedFromShare.js";

// A shared copy into the library open now. The share's token goes to the server before the
// copy is saved, so its push is let in uncounted rather than reserving a slot on the
// reader's month (docs/architecture/tiers.md, "Reserving on the reader's own key").
export function useSaveFromShare(): (token: ShareToken, snapshot: SharedOverview) => Promise<Overview> {
  const { overviewStore } = useStores();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

  return useCallback(
    async (token, snapshot) => {
      const overview = savedFromShare(snapshot.note);
      if (apiUrl !== null) {
        await createFetchGenerationApi({ baseUrl: apiUrl, token: connection.token })
          .reserve(overview.id, token)
          .catch(() => undefined);
      }
      await overviewStore.saveOverview(overview);
      return overview;
    },
    [overviewStore, apiUrl, connection.token],
  );
}
