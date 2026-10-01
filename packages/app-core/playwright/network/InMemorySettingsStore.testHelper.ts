import { DEFAULT_SETTINGS, mergeSettingsRecord, type Settings, type SettingsStore } from "@overview/domain";

export class InMemorySettingsStore implements SettingsStore {
  #settings: Settings = DEFAULT_SETTINGS;

  seedSettings(patch: Partial<Settings>) {
    this.#settings = { ...this.#settings, ...patch };
  }

  async get() {
    return this.#settings;
  }

  async unreadable() {
    return null;
  }

  async update(patch: Partial<Settings>) {
    this.#settings = mergeSettingsRecord(this.#settings, patch) as Settings;
    return this.#settings;
  }
}
