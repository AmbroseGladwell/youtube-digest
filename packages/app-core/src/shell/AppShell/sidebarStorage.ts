import { z } from "zod";

const STORAGE_KEY = "overview.sidebar.v1";
const SidebarChoice = z.enum(["open", "hidden"]);
export type SidebarChoice = z.infer<typeof SidebarChoice>;

export const readSidebarChoice = (storage: Storage = globalThis.localStorage): SidebarChoice | null => {
  try {
    const parsed = SidebarChoice.safeParse(storage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const writeSidebarChoice = (choice: SidebarChoice, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, choice);
  } catch {
    return;
  }
};
