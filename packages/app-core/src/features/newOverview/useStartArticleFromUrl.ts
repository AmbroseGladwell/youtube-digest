import { useCallback } from "react";
import { domainOf, type CaptureEntry, type OverviewId } from "@overview/domain";
import { createFetchArticleApi } from "@overview/sync";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useNewOverviewRunController } from "./NewOverviewRunContext.js";

export interface ArticleFromUrlOptions {
  from: CaptureEntry;
  title: string;
  overviewId?: OverviewId | undefined;
  captureReason?: string | null | undefined;
}

// An article we hold only the link to, read again by our server inside the run
// (docs/features/pasted-article-links.md). Null where there's no account on a server to fetch through.
export function useStartArticleFromUrl() {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { startArticle } = useNewOverviewRunController();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;
  const token = connection.token;

  const start = useCallback(
    (url: string, { from, title, overviewId, captureReason }: ArticleFromUrlOptions) =>
      startArticle({
        url,
        title,
        site: domainOf(url),
        from,
        overviewId,
        captureReason,
        access: Promise.resolve(true),
        asking: false,
        oneTimeAccess: false,
        fetched: true,
        read: () => createFetchArticleApi({ baseUrl: apiUrl!, token }).read(url),
      }),
    [apiUrl, token, startArticle],
  );

  return available ? start : null;
}
