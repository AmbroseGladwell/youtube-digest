import type { Stores } from "./StoresContext.js";

export interface Library {
  accountId: string | null;
  stores: Stores;
  close: () => void;
}

export interface OpenLibraryOptions {
  // False for a library opened only to be read from, so nothing follows it.
  shown?: boolean;
}

export type OpenLibrary = (accountId: string | null, options?: OpenLibraryOptions) => Promise<Library>;

export type DeleteLibrary = (accountId: string) => Promise<void>;
