import { createContext, useContext } from "react";

export type DeleteLibraryWhenClosed = (accountId: string) => Promise<void>;

const DeleteLibraryContext = createContext<DeleteLibraryWhenClosed | null>(null);

export const DeleteLibraryProvider = DeleteLibraryContext.Provider;

// Removes an account's library from this device once the app has stopped showing it, which
// is what a deleted account asks for. Null outside a shell that has libraries to delete
// (docs/features/account-deletion.md, "On the device").
export function useDeleteLibrary(): DeleteLibraryWhenClosed | null {
  return useContext(DeleteLibraryContext);
}
