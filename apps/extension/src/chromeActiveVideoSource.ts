import { isYouTubeUrl, type ActiveVideoSource } from "@overview/app-core";

// The side panel belongs to one window, so the video in front of it is that window's
// active tab (docs/features/watching-detection.md).
let videoUrl: string | null = null;
const listeners = new Set<() => void>();

// pendingUrl covers a tab that has come to the front before its navigation commits, which
// a tab opened from another app does (docs/features/watching-detection.md).
async function readActiveVideoUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || tab?.pendingUrl;
  return url !== undefined && isYouTubeUrl(url) ? url : null;
}

async function refresh(): Promise<void> {
  const next = await readActiveVideoUrl();
  if (next === videoUrl) return;
  videoUrl = next;
  for (const listener of listeners) listener();
}

const onActivated = () => void refresh();

// YouTube navigates without a page load, so a new video is a URL change on an open tab.
const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") void refresh();
};

export const chromeActiveVideoSource: ActiveVideoSource = {
  getVideoUrl: () => videoUrl,
  subscribe: (onChange) => {
    listeners.add(onChange);
    if (listeners.size === 1) {
      chrome.tabs.onActivated.addListener(onActivated);
      chrome.tabs.onUpdated.addListener(onUpdated);
    }
    void refresh();

    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        chrome.tabs.onActivated.removeListener(onActivated);
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };
  },
};
