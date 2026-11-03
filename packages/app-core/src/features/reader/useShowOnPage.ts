import { useCallback, useState } from "react";
import { articlePlaceUrl, canonicalArticleUrl, type ArticlePlace, type WebSource } from "@overview/domain";
import { useActivePage, useArticlePages, type ActivePage } from "../../app/ArticlePagesContext.js";

export type PlaceStatus = "shown" | "missing";

export interface ShowOnPage {
  beside: ActivePage;
  statusOf: (place: ArticlePlace) => PlaceStatus | null;
  show: (place: ArticlePlace) => void;
}

export function useArticleBeside(url: string | null): ActivePage | null {
  const page = useActivePage();
  return page !== null && url !== null && page.url === canonicalArticleUrl(url, null) ? page : null;
}

// Beside the article a link moves the page rather than opening a tab, and there we can tell
// when the place has gone (designs 77r, 77x, 77y). Null anywhere else, which is what keeps
// a link an ordinary link. If we can't get into the page at all, the place's own address
// still gets the reader there.
export function useShowOnPage(source: WebSource | null): ShowOnPage | null {
  const pages = useArticlePages();
  const beside = useArticleBeside(source?.url ?? null);
  const [shown, setShown] = useState<{ quote: string; status: PlaceStatus } | null>(null);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());

  const show = useCallback(
    (place: ArticlePlace) => {
      if (pages === null || beside === null || source === null) return;
      void pages.showPlace(beside.tabId, place).then((found) => {
        if (found === null) {
          window.open(articlePlaceUrl(source.url, place), "_blank", "noopener");
        } else if (found) {
          setShown({ quote: place.quote, status: "shown" });
        } else {
          setMissing((current) => new Set(current).add(place.quote));
        }
      });
    },
    [pages, beside, source],
  );

  if (beside === null) return null;
  return {
    beside,
    show,
    statusOf: ({ quote }) => (missing.has(quote) ? "missing" : shown?.quote === quote ? shown.status : null),
  };
}
