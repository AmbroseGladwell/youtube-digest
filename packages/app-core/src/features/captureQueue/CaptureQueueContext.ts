import { createContext, useContext } from "react";
import type { CaptureQueueController } from "./useCaptureQueue.js";

const CaptureQueueContext = createContext<CaptureQueueController | null>(null);

export const CaptureQueueProvider = CaptureQueueContext.Provider;

export const useCaptureQueueController = (): CaptureQueueController => {
  const controller = useContext(CaptureQueueContext);
  if (!controller) {
    throw new Error("useCaptureQueueController must be used within a CaptureQueueProvider");
  }
  return controller;
};
