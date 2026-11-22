import type { Settings } from "./Settings.js";
import type { UnreadableRecord } from "./UnreadableRecord.js";

export interface SettingsStore {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
  // An unreadable singleton falls back to defaults, but never silently (docs/features/record-migrations.md).
  unreadable(): Promise<UnreadableRecord | null>;
}
