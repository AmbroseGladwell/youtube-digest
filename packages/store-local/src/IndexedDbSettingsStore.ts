import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  SETTINGS_MIGRATIONS,
  Settings,
  UnreadableRecordError,
  mergeSettingsRecord,
  migrateStoredRecord,
  readStoredRecord,
  stampStoredRecord,
  unreadableRecord,
  type SettingsStore,
  type UnreadableRecord,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { SETTINGS_KEY, SETTINGS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

export class IndexedDbSettingsStore implements SettingsStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async get() {
    const read = readStoredRecord(await this.#raw(), Settings, SETTINGS_MIGRATIONS);
    return read.status === "read" ? read.record : DEFAULT_SETTINGS;
  }

  async unreadable(): Promise<UnreadableRecord | null> {
    const raw = await this.#raw();
    const read = readStoredRecord(raw, Settings, SETTINGS_MIGRATIONS);
    return read.status === "read"
      ? null
      : unreadableRecord("settings", SETTINGS_KEY, read, raw);
  }

  async update(patch: Partial<Settings>) {
    const raw = await this.#raw();
    const migrated = migrateStoredRecord(raw, SETTINGS_MIGRATIONS);
    if (migrated.status === "unreadable") {
      throw new UnreadableRecordError(unreadableRecord("settings", SETTINGS_KEY, migrated, raw));
    }

    const now = new Date();
    const transaction = this.#db.transaction([SETTINGS_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction
      .objectStore(SETTINGS_STORE)
      .put(stampStoredRecord(mergeSettingsRecord(migrated.record, patch), CURRENT_SETTINGS_SCHEMA_VERSION, now), SETTINGS_KEY);
    const journaled = await appendPendingWrite(transaction, {
      kind: "settings",
      id: SETTINGS_KEY,
      updatedAt: now.toISOString(),
      change: { op: "settings", patch },
    });
    await promisifyTransaction(transaction);
    if (journaled) this.#onJournaled?.();
    return this.get();
  }

  async #raw(): Promise<Record<string, unknown>> {
    const store = this.#db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE);
    const stored = await promisifyRequest<unknown>(store.get(SETTINGS_KEY));
    return {
      ...DEFAULT_SETTINGS,
      ...(typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {}),
    };
  }
}
