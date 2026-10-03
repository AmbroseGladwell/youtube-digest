import type { Stores } from "./StoresContext.js";

// One account's library on this device, or the no-account one when accountId is null
// (docs/features/account-libraries.md).
export interface Library {
  accountId: string | null;
  stores: Stores;
  close: () => void;
}

export interface OpenLibraryOptions {
  // False for a library opened only to be read from, as the move on sign-in opens the
  // no-account one: it is not what the app is showing, so nothing should follow it.
  shown?: boolean;
}

export type OpenLibrary = (accountId: string | null, options?: OpenLibraryOptions) => Promise<Library>;
