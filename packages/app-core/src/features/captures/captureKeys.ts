import { overviewKeys } from "../overviews/overviewKeys.js";

// Under the overviews' key, so every pull and every new overview refreshes them too.
export const captureKeys = {
  all: [...overviewKeys.all, "captures"] as const,
};
