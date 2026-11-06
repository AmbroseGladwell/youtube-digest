import { forgetCaptureQueuePreferences } from "../captureQueue/captureQueuePreferencesStorage.js";
import { forgetLibraryView } from "../library/libraryViewStorage.js";
import { forgetReadingPositions } from "../transcripts/readingPositionStorage.js";

// What this device kept about an account outside its library: the list's view, the queue's
// preferences and the reading positions, each keyed by the account. The record that some
// account was once signed in here is kept, since it never said whose
// (docs/features/account-deletion.md, "On the device").
export function forgetAccountOnDevice(accountId: string, storage: Storage = globalThis.localStorage): void {
  forgetLibraryView(accountId, storage);
  forgetCaptureQueuePreferences(accountId, storage);
  forgetReadingPositions(accountId, storage);
}
