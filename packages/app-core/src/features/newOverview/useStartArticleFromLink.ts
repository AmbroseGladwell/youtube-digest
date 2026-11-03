import { useCallback } from "react";
import { domainOf, type CaptureEntry, type ExtractedArticle } from "@overview/domain";
import { useNewOverviewRunController } from "./NewOverviewRunContext.js";

// The read has happened by the time Generate is pressed, so the run spends it.
export function useStartArticleFromLink() {
  const { startArticle } = useNewOverviewRunController();
  return useCallback(
    (article: ExtractedArticle, from: CaptureEntry) =>
      startArticle({
        url: article.url,
        title: article.title,
        site: article.siteName ?? domainOf(article.url),
        from,
        access: Promise.resolve(true),
        asking: false,
        oneTimeAccess: false,
        fetched: true,
        read: async () => ({ status: "read", article }),
      }),
    [startArticle],
  );
}
