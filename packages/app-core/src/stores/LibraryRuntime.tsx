import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppBuild } from "../app/AppBuildContext.js";
import { useDefaultApiUrl } from "../app/DefaultApiUrlContext.js";
import { useLayout } from "../app/LayoutContext.js";
import { reportStartupFailure } from "../app/reportStartupFailure.js";
import { StartupFailure } from "../app/StartupFailure.js";
import { useSurface } from "../app/SurfaceContext.js";
import { libraryAccountIdOf } from "../features/sync/types/SyncConnection.js";
import { useSyncConnection } from "../features/sync/useSyncConnection.js";
import { DeleteLibraryProvider } from "./DeleteLibraryContext.js";
import type { DeleteLibrary, Library, OpenLibrary } from "./Library.js";
import { LibraryAccountProvider } from "./LibraryAccountContext.js";
import { OpenLibraryProvider } from "./OpenLibraryContext.js";
import { StoresProvider } from "./StoresContext.js";

export interface LibraryRuntimeProps {
  library: Library;
  openLibrary: OpenLibrary;
  deleteLibrary: DeleteLibrary;
  children: ReactNode;
}

interface PendingDeletion {
  accountId: string;
  resolve: () => void;
  reject: (error: unknown) => void;
}

const BLOCKED = "LocalDatabaseBlockedError";

// Follows the signed-in account: opens that account's library, or the no-account one, and
// swaps the stores under the running app rather than remounting it, so a screen mid-flow
// keeps its place (docs/features/account-libraries.md).
export function LibraryRuntime({ library: initial, openLibrary, deleteLibrary, children }: LibraryRuntimeProps) {
  const { connection } = useSyncConnection();
  const wanted = libraryAccountIdOf(connection);
  const queryClient = useQueryClient();
  const surface = useSurface();
  const layout = useLayout();
  const build = useAppBuild();
  const defaultApiUrl = useDefaultApiUrl();
  const [library, setLibrary] = useState(initial);
  const [failure, setFailure] = useState<{ blocked: boolean } | null>(null);
  const shown = useRef(library);
  const pendingDeletions = useRef<PendingDeletion[]>([]);

  useEffect(() => {
    if (wanted === library.accountId) return;
    let superseded = false;
    openLibrary(wanted).then(
      (opened) => (superseded ? opened.close() : setLibrary(opened)),
      (error: unknown) => {
        if (superseded) return;
        console.error(error);
        const blocked = error instanceof Error && error.name === BLOCKED;
        if (!blocked) void reportStartupFailure(error, { surface, layout, build, defaultApiUrl });
        setFailure({ blocked });
      },
    );
    return () => {
      superseded = true;
    };
  }, [wanted, library.accountId, openLibrary, surface, layout, build, defaultApiUrl]);

  useEffect(() => {
    if (shown.current === library) return;
    shown.current.close();
    shown.current = library;
    void queryClient.resetQueries();
    const ready = pendingDeletions.current.filter(({ accountId }) => accountId !== library.accountId);
    pendingDeletions.current = pendingDeletions.current.filter((pending) => !ready.includes(pending));
    for (const { accountId, resolve, reject } of ready) deleteLibrary(accountId).then(resolve, reject);
  }, [library, queryClient, deleteLibrary]);

  // A deleted account's library goes once the app has swapped away from it and closed it,
  // never while it is open (docs/features/account-deletion.md, "On the device").
  const deleteWhenClosed = useCallback(
    (accountId: string) =>
      new Promise<void>((resolve, reject) => {
        if (shown.current.accountId !== accountId) {
          deleteLibrary(accountId).then(resolve, reject);
          return;
        }
        pendingDeletions.current.push({ accountId, resolve, reject });
      }),
    [deleteLibrary],
  );

  if (failure !== null) return <StartupFailure blocked={failure.blocked} />;

  return (
    <OpenLibraryProvider value={openLibrary}>
      <DeleteLibraryProvider value={deleteWhenClosed}>
        <LibraryAccountProvider value={library.accountId}>
          <StoresProvider value={library.stores}>{children}</StoresProvider>
        </LibraryAccountProvider>
      </DeleteLibraryProvider>
    </OpenLibraryProvider>
  );
}
