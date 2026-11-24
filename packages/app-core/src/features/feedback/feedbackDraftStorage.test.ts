import { describe, expect, test } from "vitest";
import { OverviewId } from "@overview/domain";
import { readFeedbackDraft, writeFeedbackDraft } from "./feedbackDraftStorage.js";

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

const OVERVIEW = OverviewId.parse("0b9d6f1e-7a3c-4f2e-9b1d-2c4e6a8f0a11");

describe("feedback drafts", () => {
  test("general feedback and each overview's feedback keep drafts of their own", () => {
    const storage = memoryStorage();
    writeFeedbackDraft("account-1", null, "A general idea", storage);
    writeFeedbackDraft("account-1", OVERVIEW, "About this one", storage);

    expect(readFeedbackDraft("account-1", null, storage)).toBe("A general idea");
    expect(readFeedbackDraft("account-1", OVERVIEW, storage)).toBe("About this one");
    expect(readFeedbackDraft("account-2", null, storage)).toBe("");
  });

  test("emptying the box clears its draft", () => {
    const storage = memoryStorage();
    writeFeedbackDraft("account-1", null, "Something", storage);
    writeFeedbackDraft("account-1", null, "   ", storage);

    expect(storage.length).toBe(0);
    expect(readFeedbackDraft("account-1", null, storage)).toBe("");
  });
});
