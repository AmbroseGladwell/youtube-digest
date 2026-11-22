import { localDatabaseName } from "./localDatabaseName.js";

export interface DeleteLocalLibraryOptions {
  accountId: string;
  indexedDB?: IDBFactory;
}

// Closed first: docs/features/account-deletion.md, "On the device".
export const deleteLocalLibrary = ({ accountId, indexedDB = globalThis.indexedDB }: DeleteLocalLibraryOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(localDatabaseName(accountId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
