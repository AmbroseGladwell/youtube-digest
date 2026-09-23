import type { Settings } from "./Settings.js";
import type { UnreadableRecord } from "./UnreadableRecord.js";

export interface SettingsStore {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
  // A singleton has nothing to quarantine around, so an unreadable one falls back to the
  // defaults. Resetting is survivable; resetting silently is not
  // (docs/features/record-migrations.md).
  unreadable(): Promise<UnreadableRecord | null>;
}
