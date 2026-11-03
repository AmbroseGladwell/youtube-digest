import { useEffect } from "react";
import { domainOf } from "@overview/domain";
import { useNavigate } from "react-router";
import { useArticlePages } from "../../app/ArticlePagesContext.js";
import { Routes } from "../../app/Routes.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";

// The right-click route. It lives beside the run, as the injected button's does, because the
// panel can be anywhere when the menu is chosen, or not yet open. The menu's click granted
// activeTab, so nothing is asked and the run goes straight to reading (design 77ag).
export function useArticleMenuRequest({ startArticle }: Pick<NewOverviewRunController, "startArticle">): void {
  const pages = useArticlePages();
  const navigate = useNavigate();
  const readiness = useGenerationReadiness();

  useEffect(() => {
    if (pages === null) return;
    const take = () => {
      const page = pages.takeMenuRequest();
      if (page === null) return;
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
}
