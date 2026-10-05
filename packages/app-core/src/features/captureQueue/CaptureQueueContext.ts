import { createContext, useContext } from "react";
import type { CaptureQueueController } from "./useCaptureQueue.js";

// Owned by the AppShell, as the reader's own run is, and handed down to the library's queue
// group, the queue page and the panel's home (docs/features/capture-queue.md).
const CaptureQueueContext = createContext<CaptureQueueController | null>(null);

export const CaptureQueueProvider = CaptureQueueContext.Provider;

export function useCaptureQueueController(): CaptureQueueController {
  const controller = useContext(CaptureQueueContext);
  if (!controller) {
    throw new Error("useCaptureQueueController must be used within a CaptureQueueProvider");
  }
  return controller;
}
