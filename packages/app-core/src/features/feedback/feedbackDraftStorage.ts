import type { OverviewId } from "@overview/domain";

const STORAGE_KEY = "overview.feedbackDraft.v1";

const keyFor = (accountId: string | null, overviewId: OverviewId | null): string =>
  [STORAGE_KEY, accountId ?? "none", overviewId ?? "general"].join(".");

// On this device only, never synced: docs/features/feedback.md, "Drafts".
export const readFeedbackDraft = (
  accountId: string | null,
  overviewId: OverviewId | null,
  storage: Storage = globalThis.localStorage,
): string => {
  try {
    return storage.getItem(keyFor(accountId, overviewId)) ?? "";
  } catch {
    return "";
  }
};

export const writeFeedbackDraft = (
  accountId: string | null,
  overviewId: OverviewId | null,
  text: string,
  storage: Storage = globalThis.localStorage,
): void => {
  try {
    if (text.trim() === "") {
      storage.removeItem(keyFor(accountId, overviewId));
    } else {
      storage.setItem(keyFor(accountId, overviewId), text);
    }
  } catch {}
};
