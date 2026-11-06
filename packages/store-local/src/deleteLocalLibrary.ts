import { localDatabaseName } from "./localDatabaseName.js";

export interface DeleteLocalLibraryOptions {
  accountId: string;
  indexedDB?: IDBFactory;
}

// Removes an account's library from this device, once the account is deleted. The database
// has to be closed first: a deletion while it is open waits on `versionchange`, and the open
// connection would answer that by closing itself and declaring the tab out of date
// (docs/features/account-deletion.md, "On the device").
export function deleteLocalLibrary({ accountId, indexedDB = globalThis.indexedDB }: DeleteLocalLibraryOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(localDatabaseName(accountId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
