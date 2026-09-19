import type { RunReport } from "@overview/app-core";
import { IndexedDbOverviewStore, openLocalDatabase } from "@overview/store-local";
import {
  BridgeMessage,
  isReadButtonState,
  isReportRun,
  isRequestOverview,
  isTakeRequest,
  type ButtonState,
} from "./overviewBridge.js";
import { overviewButtonState } from "./overviewButtonState.js";

// Top level, not onInstalled: this re-runs on every worker start, so the toolbar icon keeps
// opening the panel even if the flag doesn't survive a profile restart or an update.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// A worker is killed between messages, so anything that has to outlive one goes to
// session storage rather than a module variable — the request in particular is written
// before the panel exists to read it (docs/features/injected-button.md).
const PENDING_REQUEST = "overview/pending-request";
const LATEST_REPORT = "overview/latest-report";

async function readSession<T>(key: string): Promise<T | null> {
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as T | undefined) ?? null;
}

let database: Promise<IDBDatabase> | null = null;

async function holdsOverviewOf(videoId: string): Promise<boolean> {
  try {
    database ??= openLocalDatabase();
    const overviews = await new IndexedDbOverviewStore(await database).listOverviews();
    return overviews.some((overview) => overview.video.id === videoId);
  } catch {
    return false;
  }
}

async function stateFor(videoId: string, report: RunReport | null): Promise<ButtonState> {
  return overviewButtonState({ videoId, report, held: await holdsOverviewOf(videoId) });
}

// Every watch tab, because the panel belongs to a window and a run is for one video:
// each button decides for itself whether the report is about the video it sits on.
async function broadcast(report: RunReport | null): Promise<void> {
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });

  await Promise.all(
    tabs.map(async (tab) => {
      const videoId = tab.url === undefined ? null : new URL(tab.url).searchParams.get("v");
      if (tab.id === undefined || videoId === null) {
        return;
      }
      const state = await stateFor(videoId, report);
      await chrome.tabs
        .sendMessage(tab.id, { type: BridgeMessage.BUTTON_STATE_CHANGED, videoId, state })
        .catch(() => undefined);
    }),
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isRequestOverview(message)) {
    const windowId = sender.tab?.windowId;
    void (async () => {
      await chrome.storage.session.set({ [PENDING_REQUEST]: message.videoUrl });
      if (windowId !== undefined) {
        await chrome.sidePanel.open({ windowId }).catch(() => undefined);
      }
      // A panel that was already open is not opened again and would otherwise wait until
      // its next mount to notice the request.
      void chrome.runtime.sendMessage(message).catch(() => undefined);
      sendResponse({ opened: windowId !== undefined });
    })();
    return true;
  }

  if (isTakeRequest(message)) {
    void (async () => {
      const videoUrl = await readSession<string>(PENDING_REQUEST);
      await chrome.storage.session.remove(PENDING_REQUEST);
      sendResponse({ videoUrl });
    })();
    return true;
  }

  if (isReportRun(message)) {
    const { report } = message as { report: RunReport | null };
    void (async () => {
      if (report === null) {
        await chrome.storage.session.remove(LATEST_REPORT);
      } else {
        await chrome.storage.session.set({ [LATEST_REPORT]: report });
      }
      await broadcast(report);
      sendResponse({ received: true });
    })();
    return true;
  }

  if (isReadButtonState(message)) {
    void (async () => {
      sendResponse(await stateFor(message.videoId, await readSession<RunReport>(LATEST_REPORT)));
    })();
    return true;
  }

  return undefined;
});
