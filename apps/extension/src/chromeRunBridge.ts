import type { RunBridge, RunReport } from "@overview/app-core";
import { BridgeMessage, isRequestOverview } from "./overviewBridge.js";

// docs/features/injected-button.md, "Three documents, one conversation".
let pending: string | null = null;
const listeners = new Set<() => void>();

const pull = async (): Promise<void> => {
  try {
    const reply = (await chrome.runtime.sendMessage({ type: BridgeMessage.TAKE_REQUEST })) as { videoUrl: string | null } | undefined;
    if (reply?.videoUrl == null) {
      return;
    }
    pending = reply.videoUrl;
    for (const listener of listeners) {
      listener();
    }
  } catch {
    // No worker to answer, so nothing is waiting.
  }
};

// A press while the panel is already open opens nothing, so the worker says so out loud.
const onMessage = (message: unknown) => {
  if (isRequestOverview(message)) {
    void pull();
  }
};

export const chromeRunBridge: RunBridge = {
  subscribe: (onChange) => {
    listeners.add(onChange);
    if (listeners.size === 1) {
      chrome.runtime.onMessage.addListener(onMessage);
      void pull();
    }
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        chrome.runtime.onMessage.removeListener(onMessage);
      }
    };
  },

  takeRequest: () => {
    const videoUrl = pending;
    pending = null;
    return videoUrl;
  },

  report: (report: RunReport | null) => {
    void chrome.runtime.sendMessage({ type: BridgeMessage.REPORT_RUN, report }).catch(() => undefined);
  },
};
