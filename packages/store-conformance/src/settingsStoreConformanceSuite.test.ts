import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from "@overview/domain";
import { defineSettingsStoreConformanceSuite } from "./settingsStoreConformanceSuite.js";

class InMemorySettingsStore implements SettingsStore {
  #settings: Settings = DEFAULT_SETTINGS;

  async get() {
    return this.#settings;
  }

  async unreadable() {
    return null;
  }

  async update(patch: Partial<Settings>) {
    this.#settings = { ...this.#settings, ...patch };
    return this.#settings;
  }
}

defineSettingsStoreConformanceSuite("InMemorySettingsStore (reference)", () => new InMemorySettingsStore());
