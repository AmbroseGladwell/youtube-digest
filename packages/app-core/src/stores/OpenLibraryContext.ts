import { createContext, useContext } from "react";
import type { OpenLibrary } from "./Library.js";

const OpenLibraryContext = createContext<OpenLibrary | null>(null);

export const OpenLibraryProvider = OpenLibraryContext.Provider;

// How to open another library beside the one shown, for the move on sign-in. Null outside
// a shell that has libraries to open.
export function useOpenLibrary(): OpenLibrary | null {
  return useContext(OpenLibraryContext);
}
