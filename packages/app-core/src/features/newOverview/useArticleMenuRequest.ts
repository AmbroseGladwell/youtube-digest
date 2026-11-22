import { useEffect } from "react";
import { domainOf } from "@overview/domain";
import { useNavigate } from "react-router";
import { useArticlePages } from "../../app/ArticlePagesContext.js";
import { Routes } from "../../app/Routes.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";

// docs/features/article-panel.md, "Right-click".
export const useArticleMenuRequest = ({ startArticle }: Pick<NewOverviewRunController, "startArticle">): void => {
  const pages = useArticlePages();
  const navigate = useNavigate();
  const readiness = useGenerationReadiness();

  useEffect(() => {
    // As the injected button: the menu opens the panel before readiness has answers.
    if (pages === null || !readiness.settled) {
      return;
    }
    const take = () => {
      const page = pages.takeMenuRequest();
      if (page === null) {
        return;
      }
      if (readiness.accountNeeded) {
        void navigate(Routes.createAccount());
        return;
      }
      if (!readiness.ready) {
        void navigate(Routes.settingsSection("keys"));
        return;
      }
      startArticle({
        url: page.url,
        title: page.title,
        site: domainOf(page.url),
        from: "pageMenu",
        access: Promise.resolve(true),
        asking: false,
        oneTimeAccess: true,
        read: () => pages.read(page.tabId),
      });
      void navigate(Routes.home());
    };
    take();
    return pages.subscribe(take);
  }, [pages, readiness, navigate, startArticle]);
};
