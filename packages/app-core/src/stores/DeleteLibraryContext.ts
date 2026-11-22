import { createContext, useContext } from "react";

export type DeleteLibraryWhenClosed = (accountId: string) => Promise<void>;

const DeleteLibraryContext = createContext<DeleteLibraryWhenClosed | null>(null);

export const DeleteLibraryProvider = DeleteLibraryContext.Provider;

export const useDeleteLibrary = (): DeleteLibraryWhenClosed | null => {
  return useContext(DeleteLibraryContext);
};
