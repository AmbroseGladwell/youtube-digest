import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from "@overview/types";

export class InMemorySettingsStore implements SettingsStore {
  #settings: Settings = DEFAULT_SETTINGS;

  seedSettings(patch: Partial<Settings>) {
    this.#settings = { ...this.#settings, ...patch };
  }

  async get() {
    return this.#settings;
  }

  async update(patch: Partial<Settings>) {
    this.#settings = { ...this.#settings, ...patch };
    return this.#settings;
  }
}
