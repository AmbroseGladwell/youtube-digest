import { z } from "zod";
import type { ErrorDestination } from "@overview/app-core";

const ERROR_DESTINATION = "overview/error-destination";

const StoredErrorDestination = z.object({
  apiUrl: z.url().nullable(),
  token: z.string().min(1).nullable(),
});

// Session storage, not local: it is held in memory and gone when the browser closes, and
// content scripts can't read it, which nothing here may change
// (docs/architecture/errors-and-logs.md, "The service worker").
export const writeErrorDestination = (destination: ErrorDestination): void =>
  void chrome.storage.session.set({ [ERROR_DESTINATION]: destination }).catch(() => undefined);

export async function readErrorDestination(): Promise<ErrorDestination | null> {
  try {
    const stored = await chrome.storage.session.get(ERROR_DESTINATION);
    const parsed = StoredErrorDestination.safeParse(stored[ERROR_DESTINATION]);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
