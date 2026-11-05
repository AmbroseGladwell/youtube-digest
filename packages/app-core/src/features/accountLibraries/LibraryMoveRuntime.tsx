import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useOpenLibrary } from "../../stores/OpenLibraryContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { topicKeys } from "../overviews/topicKeys.js";
import { settingsKeys } from "../settings/settingsKeys.js";
import { useSync } from "../sync/SyncContext.js";
import { moveReadingPositions } from "../transcripts/readingPositionStorage.js";
import { LibraryMoveProvider } from "./LibraryMoveContext.js";
import { moveAnswersInto } from "./moveAnswersInto.js";
import { moveFollowingInto } from "./moveFollowingInto.js";
import { moveLibraryInto } from "./moveLibraryInto.js";
import { playlistKeys } from "../playlists/playlistKeys.js";
import { captureQueueKeys } from "../captureQueue/captureQueueKeys.js";
import type { LibraryMove } from "./types/LibraryMove.js";

// Signed in, once the account's library has pulled, what this device made without an
// account moves into it, one overview per video, along with what onboarding asked. It runs on every start that finds the
// no-account library holding something, which is also how a move that stopped is finished,
// and again when asked, for onboarding's overview landing after the account exists; moves
// run one after another, never together (docs/features/account-libraries.md, "The move on sign-in").
export function LibraryMoveRuntime({ children }: { children: ReactNode }) {
  const accountId = useLibraryAccountId();
  const stores = useStores();
  const openLibrary = useOpenLibrary();
  const sync = useSync();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  const queryClient = useQueryClient();
  const [move, setMove] = useState<LibraryMove | null>(null);
  const [answersIn, setAnswersIn] = useState<string | null>(null);
  const tried = useRef(new Set<string>());
  const moving = useRef(Promise.resolve());
  const pulled = sync.connected && sync.status.lastSyncedAt !== null;

  const moveInto = useCallback(
    (into: string) =>
      (async () => {
        if (openLibrary === null) return;
        const left = await openLibrary(null, { shown: false });
        try {
          await moveAnswersInto(left.stores, stores);
          setAnswersIn(into);
          void queryClient.invalidateQueries({ queryKey: topicKeys.all });
          void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
          const result = await moveLibraryInto(left.stores, stores);
          if ((await moveFollowingInto(left.stores, stores)).playlists > 0) {
            void queryClient.invalidateQueries({ queryKey: playlistKeys.all });
            void queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
          }
          if (result.moved + result.alreadyThere === 0) return;
          moveReadingPositions(result.sourceKeys, into);
          void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
          void queryClient.invalidateQueries({ queryKey: topicKeys.all });
          analytics.account.signIn.libraryMoved({ moved: result.moved, alreadyThere: result.alreadyThere });
          setMove({ moved: result.moved, alreadyThere: result.alreadyThere });
        } finally {
          left.close();
        }
      })()
        .catch((error: unknown) => errors.report(error, "libraryMove", { handled: true }))
        .finally(() => setAnswersIn(into)),
    [openLibrary, stores, queryClient, analytics, errors],
  );

  useEffect(() => {
    if (accountId === null || openLibrary === null || !pulled || tried.current.has(accountId)) return;
    tried.current.add(accountId);
    moving.current = moving.current.then(() => moveInto(accountId));
  }, [accountId, openLibrary, pulled, moveInto]);

  // Before the first pull, the first move is still to come and will find what's there.
  const moveAgain = useCallback(() => {
    if (accountId === null || openLibrary === null || !pulled) return;
    moving.current = moving.current.then(() => moveInto(accountId));
  }, [accountId, openLibrary, pulled, moveInto]);

  useEffect(() => {
    if (accountId === null) {
      setMove(null);
      setAnswersIn(null);
    }
  }, [accountId]);

  const value = useMemo(() => ({ move, dismiss: () => setMove(null), answersIn, moveAgain }), [move, answersIn, moveAgain]);
  return <LibraryMoveProvider value={value}>{children}</LibraryMoveProvider>;
}
