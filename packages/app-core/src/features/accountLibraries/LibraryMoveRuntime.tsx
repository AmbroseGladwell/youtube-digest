import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useOpenLibrary } from "../../stores/OpenLibraryContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { topicKeys } from "../overviews/topicKeys.js";
import { useSync } from "../sync/SyncContext.js";
import { moveReadingPositions } from "../transcripts/readingPositionStorage.js";
import { LibraryMoveProvider } from "./LibraryMoveContext.js";
import { moveLibraryInto } from "./moveLibraryInto.js";
import type { LibraryMove } from "./types/LibraryMove.js";

// Signed in, once the account's library has pulled, what this device made without an
// account moves into it, one overview per video. It runs on every start that finds the
// no-account library holding something, which is also how a move that stopped is finished
// (docs/features/account-libraries.md, "The move on sign-in").
export function LibraryMoveRuntime({ children }: { children: ReactNode }) {
  const accountId = useLibraryAccountId();
  const stores = useStores();
  const openLibrary = useOpenLibrary();
  const sync = useSync();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  const queryClient = useQueryClient();
  const [move, setMove] = useState<LibraryMove | null>(null);
  const tried = useRef(new Set<string>());
  const pulled = sync.connected && sync.status.lastSyncedAt !== null;

  useEffect(() => {
    if (accountId === null || openLibrary === null || !pulled || tried.current.has(accountId)) return;
    tried.current.add(accountId);
    void (async () => {
      const left = await openLibrary(null, { shown: false });
      try {
        const result = await moveLibraryInto(left.stores, stores);
        if (result.moved + result.alreadyThere === 0) return;
        moveReadingPositions(result.videoIds, accountId);
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: topicKeys.all });
        analytics.account.signIn.libraryMoved({ moved: result.moved, alreadyThere: result.alreadyThere });
        setMove({ moved: result.moved, alreadyThere: result.alreadyThere });
      } finally {
        left.close();
      }
    })().catch((error: unknown) => errors.report(error, "libraryMove", { handled: true }));
  }, [accountId, openLibrary, pulled, stores, queryClient, analytics, errors]);

  useEffect(() => {
    if (accountId === null) setMove(null);
  }, [accountId]);

  const value = useMemo(() => ({ move, dismiss: () => setMove(null) }), [move]);
  return <LibraryMoveProvider value={value}>{children}</LibraryMoveProvider>;
}
