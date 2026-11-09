import { useCallback } from "react";
import { domainOf, type CaptureEntry, type OverviewId } from "@overview/domain";
import { useArticlePages, type ActivePage } from "../../app/ArticlePagesContext.js";
import { useNewOverviewRunController } from "./NewOverviewRunContext.js";

export interface ArticleRunOptions {
  from: CaptureEntry;
  overviewId?: OverviewId | undefined;
  captureReason?: string | null | undefined;
  // Known not to be needed, so Chrome isn't asked outside a click: right-click grants its own
  // access, and a reload only follows a read that got in.
  accessInHand?: boolean;
  oneTimeAccess?: boolean;
  // Whether Chrome will put up its box, known from the access check the panel already made.
  willAsk?: boolean;
}

// Call it from the click: requestAccess spends the gesture (docs/features/article-panel.md).
export function useStartArticleRun() {
  const pages = useArticlePages();
  const { startArticle } = useNewOverviewRunController();

  return useCallback(
    (
      page: ActivePage,
      { from, overviewId, captureReason, accessInHand = false, oneTimeAccess = false, willAsk = false }: ArticleRunOptions,
    ) => {
      if (pages === null) return;
      startArticle({
        url: page.url,
        title: page.title,
        site: domainOf(page.url),
        from,
        overviewId,
        captureReason,
        access: accessInHand ? Promise.resolve(true) : pages.requestAccess(page.url),
        asking: !accessInHand && willAsk,
        oneTimeAccess,
        read: () => pages.read(page.tabId),
      });
    },
    [pages, startArticle],
  );
}
