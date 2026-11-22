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

// docs/features/account-libraries.md, "Installs already signed in".
export const adoptLibraryIntoAccount = async ({ accountId, indexedDB }: AdoptLibraryIntoAccountOptions): Promise<void> => {
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
        const [keys, values] = await Promise.all([promisifyRequest(store.getAllKeys()), promisifyRequest(store.getAll())]);
        return { name, keys, values };
      }),
    );

    const writing = into.transaction(names, "readwrite");
    for (const { name, keys, values } of contents) {
      const store = writing.objectStore(name);
      values.forEach((value, index) => {
        if (store.keyPath === null) {
          store.put(value, keys[index]);
        } else {
          store.put(value);
        }
      });
    }
    await promisifyTransaction(writing);

    const clearing = from.transaction(names, "readwrite");
    for (const name of names) {
      clearing.objectStore(name).clear();
    }
    await promisifyTransaction(clearing);
  } finally {
    from.close();
    into.close();
  }
};
