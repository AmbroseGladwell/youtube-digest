import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  SETTINGS_MIGRATIONS,
  Settings,
  UnreadableRecordError,
  migrateStoredRecord,
  readStoredRecord,
  stampStoredRecord,
  unreadableRecord,
  type SettingsStore,
  type UnreadableRecord,
} from "@overview/domain";
import { SETTINGS_KEY, SETTINGS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export class IndexedDbSettingsStore implements SettingsStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
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

    const store = this.#db.transaction(SETTINGS_STORE, "readwrite").objectStore(SETTINGS_STORE);
    await promisifyRequest(
      store.put(
        stampStoredRecord(merged(migrated.record, patch), CURRENT_SETTINGS_SCHEMA_VERSION),
        SETTINGS_KEY,
      ),
    );
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

// sectionsEnabled is merged rather than replaced: patching one toggle used to take the
// other three with it (docs/features/record-migrations.md).
function merged(current: Record<string, unknown>, patch: Partial<Settings>): Record<string, unknown> {
  const sectionsEnabled =
    patch.sectionsEnabled === undefined
      ? {}
      : {
          sectionsEnabled: {
            ...(typeof current.sectionsEnabled === "object" && current.sectionsEnabled !== null
              ? (current.sectionsEnabled as Record<string, unknown>)
              : {}),
            ...patch.sectionsEnabled,
          },
        };
  return { ...current, ...patch, ...sectionsEnabled };
}
