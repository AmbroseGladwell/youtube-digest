import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { articleSourceId, heldOverviewOf, OverviewId, sourceKey, type ExtractedArticle } from "@overview/domain";
import { createFetchArticleApi } from "@overview/sync";
import { useSurface } from "../../app/SurfaceContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useIsPhone } from "../../util/useIsPhone.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import type { ArticleFailure } from "./api/ArticleReadError.js";
import { generationKeys } from "./generationKeys.js";
import { captureFailureOf } from "./util/captureFailureOf.js";
import { ArticleReadError } from "./api/ArticleReadError.js";
import { isYouTubeUrl, youTubeLink } from "./util/parseYouTubeUrl.js";
import { pastedLinkFailureCopy, type ReaderPlace } from "./util/pastedLinkFailureCopy.js";

export type ArticleLink =
  | { status: "none" }
  | { status: "reading" }
  | { status: "found"; article: ExtractedArticle }
  | { status: "held"; overviewId: OverviewId; savedAt: string | null }
  | { status: "failed"; failure: ArticleFailure }
  | { status: "unreachable" };

const SETTLED_MS = 350;
const KEPT_MS = 5 * 60 * 1000;

export const isArticleLink = (input: string): boolean => {
  const link = input.trim();
  if (link === "" || isYouTubeUrl(link) || youTubeLink(link) !== null) return false;
  try {
    const { protocol, hostname } = new URL(link);
    return (protocol === "http:" || protocol === "https:") && hostname.includes(".");
  } catch {
    return false;
  }
};

// A pasted link is read as soon as it settles, so what it is, or why it can't be used, is known
// before Generate; reading costs nothing against the month, and Generate spends this read rather
// than fetching again (designs 77am–77ar). Null where there is no account on a server to fetch
// through, which is what hides articles from the field.
export function useArticleLink(url: string, from: "dialog" | "home") {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const surface = useSurface();
  const phone = useIsPhone();
  const analytics = useAnalytics();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;
  const place: ReaderPlace = surface === "extension" ? "extension" : phone ? "phone" : "computer";

  const link = url.trim();
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(link), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [link]);

  const offered = available && isArticleLink(link);
  const query = useQuery({
    queryKey: [...generationKeys.all, "articleLink", settled],
    enabled: offered && settled === link,
    retry: false,
    staleTime: KEPT_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ArticleLink> => {
      const read = await createFetchArticleApi({ baseUrl: apiUrl!, token: connection.token }).read(link);
      if (read.status === "failed") return { status: "failed", failure: read };
      const key = sourceKey({ kind: "web", id: await articleSourceId(read.article.url) })!;
      const held = await heldOverviewOf(overviewStore, key);
      if (held === null) return { status: "found", article: read.article };
      const overviews = await overviewStore.listOverviews();
      return {
        status: "held",
        overviewId: OverviewId.parse(held.id),
        savedAt: overviews.find(({ id }) => id === held.id)?.savedAt ?? null,
      };
    },
  });

  const articleLink: ArticleLink = useMemo(() => {
    if (!offered) return { status: "none" };
    if (settled !== link || query.isFetching) return { status: "reading" };
    if (query.isError) return { status: "unreachable" };
    return query.data ?? { status: "reading" };
  }, [offered, settled, link, query.isFetching, query.isError, query.data]);

  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (articleLink.status !== "failed" || reported.current === link) return;
    reported.current = link;
    analytics.capture.newOverviewForm.articleLinkFailed({
      from,
      failure: captureFailureOf(new ArticleReadError(articleLink.failure), { transcriptResolved: false }),
      sentToExtension: pastedLinkFailureCopy(articleLink.failure, link, place).sentToExtension,
    });
  }, [articleLink, link, from, place, analytics]);

  return { available, link: articleLink, place, retry: () => void query.refetch() };
}
