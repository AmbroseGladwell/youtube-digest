import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, Settings, type SettingsStore } from "@overview/domain";

export function defineSettingsStoreConformanceSuite(
  label: string,
  createStore: () => SettingsStore | Promise<SettingsStore>,
): void {
  const behaviour = (description: string) => `${label} SettingsStore: ${description}`;

  test(behaviour("get() seeds and returns the default settings before any update has been made"), async () => {
    const store = await createStore();
    assert.deepEqual(await store.get(), DEFAULT_SETTINGS);
  });

  test(behaviour("get() always returns settings that validate against the Settings schema"), async () => {
    const store = await createStore();
    const settings = await store.get();
    assert.doesNotThrow(() => Settings.parse(settings));
  });

  test(behaviour("update() persists the patch, a later get() reflects it"), async () => {
    const store = await createStore();
    await store.update({ readerContext: "I'm a beginner cook." });
    assert.equal((await store.get()).readerContext, "I'm a beginner cook.");
  });

  test(behaviour("update() returns the settings after the patch is applied"), async () => {
    const store = await createStore();
    const updated = await store.update({ readerContext: "I'm a beginner cook." });
    assert.equal(updated.readerContext, "I'm a beginner cook.");
  });

  test(behaviour("update() merges the patch onto the current settings, it does not replace them"), async () => {
    const store = await createStore();
    await store.update({ readerContext: "I'm a beginner cook." });
    const updated = await store.update({ sectionsEnabled: { verdict: false, selling: true, howToApply: true, watchAnyway: true } });
    assert.equal(updated.readerContext, "I'm a beginner cook.");
  });

  test(behaviour("update() takes every toggle a sectionsEnabled patch names"), async () => {
    const store = await createStore();
    await store.update({
      sectionsEnabled: { verdict: false, selling: false, howToApply: false, watchAnyway: false },
    });
    const updated = await store.update({
      sectionsEnabled: { verdict: true, selling: false, howToApply: false, watchAnyway: false },
    });
    assert.deepEqual(updated.sectionsEnabled, { verdict: true, selling: false, howToApply: false, watchAnyway: false });
  });

  test(behaviour("unreadable() is null while the stored settings parse"), async () => {
    const store = await createStore();
    await store.update({ readerContext: "I'm a beginner cook." });
    assert.equal(await store.unreadable(), null);
  });

  test(behaviour("consecutive updates accumulate across separate calls"), async () => {
    const store = await createStore();
    await store.update({ readerContext: "first" });
    await store.update({ sectionsEnabled: { verdict: false, selling: true, howToApply: true, watchAnyway: true } });
    const final = await store.get();
    assert.equal(final.readerContext, "first");
    assert.equal(final.sectionsEnabled.verdict, false);
  });
}
