import type { RunBridge, RunReport } from "@overview/app-core";
import { BridgeMessage, isRequestOverview } from "./overviewBridge.js";

// The panel's end of the injected button's conversation. The worker holds the request
// because it is the only one of the three documents that is always alive; this pulls it
// across as soon as there is a panel to act on it (docs/features/injected-button.md).
let pending: string | null = null;
const listeners = new Set<() => void>();

async function pull(): Promise<void> {
  try {
    const reply = (await chrome.runtime.sendMessage({ type: BridgeMessage.TAKE_REQUEST })) as
      { videoUrl: string | null } | undefined;
    if (reply?.videoUrl == null) {
      return;
    }
    pending = reply.videoUrl;
    for (const listener of listeners) listener();
  } catch {
    // No worker to answer. There is nothing waiting that we could act on either.
  }
}

// A press while the panel is already open opens nothing, so the worker says so out loud
// rather than the panel finding out at its next mount.
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
    void chrome.runtime
      .sendMessage({ type: BridgeMessage.REPORT_RUN, report })
      .catch(() => undefined);
  },
};
