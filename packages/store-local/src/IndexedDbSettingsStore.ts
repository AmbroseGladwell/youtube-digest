import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from "@overview/types";
import { SETTINGS_KEY, SETTINGS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export class IndexedDbSettingsStore implements SettingsStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
  }

  async get() {
    const store = this.#db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE);
    const settings = await promisifyRequest<Partial<Settings> | undefined>(store.get(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  async update(patch: Partial<Settings>) {
    const updated = { ...(await this.get()), ...patch };
    const store = this.#db.transaction(SETTINGS_STORE, "readwrite").objectStore(SETTINGS_STORE);
    await promisifyRequest(store.put(updated, SETTINGS_KEY));
    return updated;
  }
}
