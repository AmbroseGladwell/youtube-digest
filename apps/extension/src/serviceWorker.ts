import type { RunReport } from "@overview/app-core";
import { heldOverviewOf } from "@overview/domain";
import { IndexedDbOverviewStore, localDatabaseName, openLocalDatabase } from "@overview/store-local";
import {
  BridgeMessage,
  isReadButtonState,
  isReportRun,
  isRequestOverview,
  isTakePageRequest,
  isTakeRequest,
  type ButtonState,
} from "./overviewBridge.js";
import { overviewButtonState } from "./overviewButtonState.js";
import { fetchYouTubeInWorker } from "./fetchYouTubeInWorker.js";
import { isYouTubeFetchMessage } from "./youTubeFetchBridge.js";
import { installYouTubeOriginRule } from "./youTubeOriginRule.js";
import { appBuild } from "./appBuild.js";
import { readErrorDestination } from "./errorDestination.js";
import { onLibraryAccountChanged, readLibraryAccount } from "./libraryAccount.js";
import { PRODUCTION_API_URL } from "./productionApiUrl.js";
import { onAccentColourChanged } from "./accentColourStorage.js";
import { showAccentOnToolbar } from "./accentToolbarIcon.js";
import { createWorkerErrorReporter } from "./workerErrorReporter.js";

const errors = createWorkerErrorReporter({
  readDestination: readErrorDestination,
  defaultApiUrl: PRODUCTION_API_URL,
  appVersion: appBuild.version,
});
self.addEventListener("error", (event) => void errors.report(event.error ?? event.message));
self.addEventListener("unhandledrejection", (event) => void errors.report(event.reason));

// Top level, not onInstalled, so it re-runs on every worker start and survives a profile restart.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Top level, so a rule lost to a restart or update comes back instead of caption fetches 403ing.
void installYouTubeOriginRule();

// Chrome forgets a setIcon when the profile closes: docs/features/appearance.md, "The logo".
void showAccentOnToolbar();
chrome.runtime.onStartup.addListener(() => void showAccentOnToolbar());
onAccentColourChanged(() => void showAccentOnToolbar());

// Session storage outlives the worker: docs/features/injected-button.md, "Three documents, one conversation".
const PENDING_REQUEST = "overview/pending-request";
const LATEST_REPORT = "overview/latest-report";
const PENDING_PAGE = "overview/pending-page";
const PAGE_MENU_ITEM = "overview/create-from-page";

const readSession = async <T>(key: string): Promise<T | null> => {
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as T | undefined) ?? null;
};

const databases = new Map<string, Promise<IDBDatabase>>();

const openCurrentLibrary = async (): Promise<IDBDatabase> => {
  const name = localDatabaseName(await readLibraryAccount());
  let database = databases.get(name);
  if (database === undefined) {
    database = openLocalDatabase({ name, onSuperseded: () => databases.delete(name) });
    database.catch(() => databases.delete(name));
    databases.set(name, database);
  }
  return database;
};

// Quarantined records count: offering to generate one again is offering to buy it twice.
const holdsOverviewOf = async (videoId: string): Promise<boolean | null> => {
  try {
    const store = new IndexedDbOverviewStore(await openCurrentLibrary());
    return (await heldOverviewOf(store, videoId)) !== null;
  } catch (error) {
    void errors.report(error, { handled: true });
    return null;
  }
};

const stateFor = async (videoId: string, report: RunReport | null): Promise<ButtonState> => {
  return overviewButtonState({ videoId, report, held: await holdsOverviewOf(videoId) });
};

// Every watch tab: each button decides whether the report is about its video.
const broadcast = async (report: RunReport | null): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });

  await Promise.all(
    tabs.map(async (tab) => {
      const videoId = tab.url === undefined ? null : new URL(tab.url).searchParams.get("v");
      if (tab.id === undefined || videoId === null) {
        return;
      }
      const state = await stateFor(videoId, report);
      await chrome.tabs.sendMessage(tab.id, { type: BridgeMessage.BUTTON_STATE_CHANGED, videoId, state }).catch(() => undefined);
    }),
  );
};

// An update fires this too, and the item survives one, so a create alone would collide.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PAGE_MENU_ITEM,
      title: "Create an overview of this page",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });
});

// Opened before the first await spends the menu click's gesture: docs/features/article-panel.md, "Right-click".
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== PAGE_MENU_ITEM || tab?.id === undefined || tab.url === undefined) {
    return;
  }
  const opening = chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined);
  const { hostname, pathname } = new URL(tab.url);
  const isVideo = hostname.endsWith("youtube.com") && pathname === "/watch";
  void (async () => {
    if (isVideo) {
      await chrome.storage.session.set({ [PENDING_REQUEST]: tab.url });
      void chrome.runtime.sendMessage({ type: BridgeMessage.REQUEST_OVERVIEW, videoUrl: tab.url }).catch(() => undefined);
    } else {
      await chrome.storage.session.set({ [PENDING_PAGE]: { url: tab.url, title: tab.title ?? "", tabId: tab.id } });
      void chrome.runtime.sendMessage({ type: BridgeMessage.PAGE_MENU_REQUEST }).catch(() => undefined);
    }
    await opening;
  })();
});

// Signing in or out changes which overviews are held, so every button says so again.
onLibraryAccountChanged(() => void readSession<RunReport>(LATEST_REPORT).then(broadcast));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isRequestOverview(message)) {
    const windowId = sender.tab?.windowId;

    // Before any await: docs/features/injected-button.md, "Three documents, one conversation".
    const opening = windowId === undefined ? Promise.resolve() : chrome.sidePanel.open({ windowId }).catch(() => undefined);

    void (async () => {
      await chrome.storage.session.set({ [PENDING_REQUEST]: message.videoUrl });
      // A panel already open is not opened again, and would otherwise wait for its next mount.
      void chrome.runtime.sendMessage(message).catch(() => undefined);
      await opening;
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

  if (isTakePageRequest(message)) {
    void (async () => {
      const page = await readSession<unknown>(PENDING_PAGE);
      await chrome.storage.session.remove(PENDING_PAGE);
      sendResponse({ page });
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

  if (isYouTubeFetchMessage(message)) {
    void fetchYouTubeInWorker(message.request).then(
      (response) => sendResponse({ ok: true, response }),
      (error: unknown) => sendResponse({ ok: false, message: error instanceof Error ? error.message : "the fetch failed" }),
    );
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
