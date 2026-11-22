import { createContext, useContext } from "react";
import type { OpenLibrary } from "./Library.js";

const OpenLibraryContext = createContext<OpenLibrary | null>(null);

export const OpenLibraryProvider = OpenLibraryContext.Provider;

export const useOpenLibrary = (): OpenLibrary | null => {
  return useContext(OpenLibraryContext);
};
