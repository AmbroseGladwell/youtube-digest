import { createContext, useContext } from "react";

const LibraryAccountContext = createContext<string | null>(null);

export const LibraryAccountProvider = LibraryAccountContext.Provider;

export function useLibraryAccountId(): string | null {
  return useContext(LibraryAccountContext);
}
