import { useLocation } from "react-router";
import { Routes } from "../../app/Routes.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { readLibraryView, writeLibraryView } from "./libraryViewStorage.js";
import type { LibraryFilters } from "./types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "./types/LibraryView.js";
import { applyLibraryFilterPatch, applyLibraryView, parseLibraryView } from "./util/libraryFilterParams.js";

export interface LibraryViewLink {
  to: string;
  follow: () => void;
}

// The list's view with one change, from the view on screen or the saved one: docs/features/navigation.md, "The sidebar".
export const useLibraryViewLink = (): ((patch: Partial<LibraryFilters>) => LibraryViewLink) => {
  const { pathname, search } = useLocation();
  const accountId = libraryAccountIdOf(useSyncConnection().connection);
  let base: URLSearchParams | null = null;
  return (patch) => {
    base ??=
      pathname === Routes.home()
        ? new URLSearchParams(search)
        : applyLibraryView(new URLSearchParams(), readLibraryView(accountId)?.view ?? DEFAULT_LIBRARY_VIEW);
    const params = applyLibraryFilterPatch(base, patch);
    return { to: Routes.libraryView(params), follow: () => writeLibraryView(accountId, parseLibraryView(params)) };
  };
};
