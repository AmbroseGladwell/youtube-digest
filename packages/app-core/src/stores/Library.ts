import type { Stores } from "./StoresContext.js";

// One account's library on this device, or the no-account one when accountId is null
// (docs/features/account-libraries.md).
export interface Library {
  accountId: string | null;
  stores: Stores;
  close: () => void;
}

export type OpenLibrary = (accountId: string | null) => Promise<Library>;
