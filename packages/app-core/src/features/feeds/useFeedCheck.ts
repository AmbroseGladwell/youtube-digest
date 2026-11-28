import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFetchFeedApi } from "@overview/sync";
import { useStores } from "../../stores/StoresContext.js";
import { captureKeys } from "../captures/captureKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { checkFollowedFeeds } from "./api/checkFollowedFeeds.js";
import { feedKeys } from "./feedKeys.js";
import { useFollowedFeedsQuery } from "./queries/followedFeedsQuery.js";

// Each feed once per opening, signed in only: docs/features/followed-feeds.md, "Checking on opening".
export const useFeedCheck = (): void => {
  const { followedFeedStore, captureStore, overviewStore } = useStores();
  const queryClient = useQueryClient();
  const reporter = useErrorReporter();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const followed = useFollowedFeedsQuery();
  const checked = useRef<{ library: string; feeds: Set<string> }>({ library: "", feeds: new Set() });
  const api = useMemo(
    () => (apiUrl === null || connection.accountId === null ? null : createFetchFeedApi({ baseUrl: apiUrl, token: connection.token })),
    [apiUrl, connection.accountId, connection.token],
  );
  const library = `${connection.accountId ?? ""}|${apiUrl ?? ""}`;

  useEffect(() => {
    if (api === null || !followed.isSuccess) {
      return;
    }
    if (checked.current.library !== library) {
      checked.current = { library, feeds: new Set() };
    }
    const feeds = followed.data.filter((feed) => !checked.current.feeds.has(feed.id));
    if (feeds.length === 0) {
      return;
    }
    for (const feed of feeds) {
      checked.current.feeds.add(feed.id);
    }
    void (async () => {
      const outcome = await checkFollowedFeeds(feeds, {
        api,
        followedFeedStore,
        captureStore,
        overviewStore,
        now: () => new Date(),
        newId: () => globalThis.crypto.randomUUID(),
        warn: (warning) => reporter.warn(warning),
      });
      void queryClient.invalidateQueries({ queryKey: feedKeys.followed() });
      if (outcome.arrived > 0 || outcome.dropped > 0) {
        void queryClient.invalidateQueries({ queryKey: captureKeys.all });
      }
    })();
  }, [api, followed.isSuccess, followed.data, library, followedFeedStore, captureStore, overviewStore, queryClient, reporter]);
};
