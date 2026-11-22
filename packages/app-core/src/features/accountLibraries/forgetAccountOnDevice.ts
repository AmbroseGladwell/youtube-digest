import { forgetCaptureQueuePreferences } from "../captureQueue/captureQueuePreferencesStorage.js";
import { forgetLibraryView } from "../library/libraryViewStorage.js";
import { forgetReadingPositions } from "../transcripts/readingPositionStorage.js";

// Why the record of a past sign-in stays: docs/features/account-deletion.md, "On the device".
export const forgetAccountOnDevice = (accountId: string, storage: Storage = globalThis.localStorage): void => {
  forgetLibraryView(accountId, storage);
  forgetCaptureQueuePreferences(accountId, storage);
  forgetReadingPositions(accountId, storage);
};
