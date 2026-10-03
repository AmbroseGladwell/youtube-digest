import { localDatabaseName } from "./localDatabaseName.js";
import { DATABASE_NAME } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

export interface AdoptLibraryIntoAccountOptions {
  accountId: string;
  indexedDB?: IDBFactory;
}

interface StoreContents {
  name: string;
  keys: IDBValidKey[];
  values: unknown[];
}

// An install signed in before accounts had libraries of their own keeps everything it held,
// unsent writes and sync bookkeeping included, under that account; the no-account library
// starts empty. Copied in one transaction and then cleared in another, so a run that stops
// is finished by running it again: a second copy over the first writes the same keys, and a
// copy from the cleared library writes nothing (docs/features/account-libraries.md).
export async function adoptLibraryIntoAccount({ accountId, indexedDB }: AdoptLibraryIntoAccountOptions): Promise<void> {
  const from = await openLocalDatabase({ name: DATABASE_NAME, ...(indexedDB === undefined ? {} : { indexedDB }) });
  const into = await openLocalDatabase({
    name: localDatabaseName(accountId),
    ...(indexedDB === undefined ? {} : { indexedDB }),
  });
  try {
    const names = Array.from(from.objectStoreNames);
    const reading = from.transaction(names, "readonly");
    const contents: StoreContents[] = await Promise.all(
      names.map(async (name) => {
        const store = reading.objectStore(name);
        const [keys, values] = await Promise.all([
          promisifyRequest(store.getAllKeys()),
          promisifyRequest(store.getAll()),
        ]);
        return { name, keys, values };
      }),
    );

    const writing = into.transaction(names, "readwrite");
    for (const { name, keys, values } of contents) {
      const store = writing.objectStore(name);
      values.forEach((value, index) => (store.keyPath === null ? store.put(value, keys[index]) : store.put(value)));
    }
    await promisifyTransaction(writing);

    const clearing = from.transaction(names, "readwrite");
    for (const name of names) clearing.objectStore(name).clear();
    await promisifyTransaction(clearing);
  } finally {
    from.close();
    into.close();
  }
}
