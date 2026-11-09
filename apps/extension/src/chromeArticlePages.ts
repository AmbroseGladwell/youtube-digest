import type { ActivePage, ArticlePages } from "@overview/app-core";
import { canonicalArticleUrl } from "@overview/domain";
import { BridgeMessage, isPageMenuRequest } from "./overviewBridge.js";
import { readArticleInTab, showArticlePlaceInTab } from "./chromeArticleReader.js";
import { chromePageAccess, pagePermission } from "./chromePageAccess.js";

const RELOAD_TIMEOUT_MS = 20_000;
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "m.youtube.com", "youtube.com", "youtu.be"]);

export const isOfferablePage = (url: string): boolean => pagePermission(url) !== null && !YOUTUBE_HOSTS.has(new URL(url).hostname);

let page: ActivePage | null = null;
let menuRequest: ActivePage | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

async function refresh(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || tab?.pendingUrl;
  const next =
    url !== undefined && tab?.id !== undefined && isOfferablePage(url)
      ? { url: canonicalArticleUrl(url, null), title: tab.title ?? "", tabId: tab.id }
      : null;
  if (next?.url === page?.url && next?.title === page?.title && next?.tabId === page?.tabId) return;
  page = next;
  notify();
}

async function pullMenuRequest(): Promise<void> {
  try {
    const reply = (await chrome.runtime.sendMessage({ type: BridgeMessage.TAKE_PAGE_REQUEST })) as { page: ActivePage | null } | undefined;
    if (reply?.page == null) return;
    menuRequest = reply.page;
    notify();
  } catch {
    // No worker to answer, so nothing is waiting.
  }
}

const onActivated = () => void refresh();
const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.title !== undefined || changeInfo.status === "complete") void refresh();
};
const onMessage = (message: unknown) => {
  if (isPageMenuRequest(message)) void pullMenuRequest();
};

function reloadTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onReloaded);
      resolve();
    };
    const onReloaded = (updatedId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedId === tabId && changeInfo.status === "complete") finish();
    };
    const timeout = setTimeout(finish, RELOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(onReloaded);
    void chrome.tabs.reload(tabId).catch(finish);
  });
}

export const chromeArticlePages: ArticlePages = {
  subscribe: (onChange) => {
    listeners.add(onChange);
    if (listeners.size === 1) {
      chrome.tabs.onActivated.addListener(onActivated);
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.runtime.onMessage.addListener(onMessage);
      void pullMenuRequest();
    }
    void refresh();
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        chrome.tabs.onActivated.removeListener(onActivated);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.runtime.onMessage.removeListener(onMessage);
      }
    };
  },
  getPage: () => page,
  hasAccess: chromePageAccess.granted,
  requestAccess: chromePageAccess.request,
  read: readArticleInTab,
  reload: reloadTab,
  showPlace: showArticlePlaceInTab,
  takeMenuRequest: () => {
    const request = menuRequest;
    menuRequest = null;
    return request;
  },
};
