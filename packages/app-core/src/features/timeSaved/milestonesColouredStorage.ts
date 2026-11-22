import { z } from "zod";

const STORAGE_KEY = "overview.milestonesColoured.v1";
const MilestonesColoured = z.array(z.string());

const read = (storage: Storage): string[] => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = MilestonesColoured.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const milestonesColouredHere = (storage: Storage = globalThis.localStorage): ReadonlySet<string> => {
  return new Set(read(storage));
};

export const rememberMilestonesColoured = (ids: readonly string[], storage: Storage = globalThis.localStorage): void => {
  const kept = new Set([...read(storage), ...ids]);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...kept]));
  } catch {
    return;
  }
};
