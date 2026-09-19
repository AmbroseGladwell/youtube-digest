import {
  BridgeMessage,
  IDLE_BUTTON_STATE,
  isButtonStateChanged,
  type ButtonState,
} from "../overviewBridge.js";
import { OverviewButton } from "./OverviewButton.js";
import { findOverviewButtonHost } from "./overviewButtonHost.js";
import { OVERVIEW_BUTTON_ID } from "./overviewButtonStyles.js";

const RECONCILE_DELAY_MS = 80;
const RESIZE_DELAY_MS = 120;

let button: OverviewButton | null = null;
let watchedVideoId: string | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

const currentVideoId = (): string | null =>
  window.location.pathname === "/watch"
    ? new URL(window.location.href).searchParams.get("v")
    : null;

function press(): void {
  if (button === null) {
    return;
  }
  // Said here rather than waited for: the run is about to exist, and a button that sat
  // still until the worker answered would read as a press that missed
  // (docs/features/injected-button.md).
  button.setState({ kind: "generating", startedAt: Date.now(), progressFraction: 0 });
  void chrome.runtime
    .sendMessage({ type: BridgeMessage.REQUEST_OVERVIEW, videoUrl: window.location.href })
    .catch(() => button?.setState(IDLE_BUTTON_STATE));
}

async function readState(videoId: string): Promise<void> {
  try {
    const state = (await chrome.runtime.sendMessage({
      type: BridgeMessage.READ_BUTTON_STATE,
      videoId,
    })) as ButtonState | undefined;
    if (state && videoId === watchedVideoId) {
      button?.setState(state);
    }
  } catch {
    // The worker is asleep or the extension was reloaded under us. Idle is the honest
    // answer: it offers the run rather than claiming anything about one.
  }
}

function reconcile(): void {
  const videoId = currentVideoId();

  if (videoId === null) {
    for (const stale of document.querySelectorAll(`#${OVERVIEW_BUTTON_ID}`)) stale.remove();
    button = null;
    watchedVideoId = null;
    return;
  }

  const host = findOverviewButtonHost();
  if (host === null) {
    return;
  }

  if (button === null || !button.element.isConnected) {
    for (const stale of document.querySelectorAll(`#${OVERVIEW_BUTTON_ID}`)) stale.remove();
    button = new OverviewButton(press);
    watchedVideoId = null;
  }

  if (button.element.parentElement !== host) {
    host.append(button.element);
  }

  if (videoId !== watchedVideoId) {
    watchedVideoId = videoId;
    button.setState(IDLE_BUTTON_STATE);
    void readState(videoId);
  }
}

function scheduleReconcile(delay: number = RECONCILE_DELAY_MS): void {
  if (reconcileTimer !== null) {
    clearTimeout(reconcileTimer);
  }
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    reconcile();
  }, delay);
}

// YouTube's own navigation event is the cheap signal; the observer is the safety net for
// the action row arriving later than it. The early-out matters — YouTube mutates the
// watch page constantly, and rescheduling a timer on every one of those is work for
// nothing once the button is already placed.
const observeRebuilds = () => {
  new MutationObserver(() => {
    if (button?.element.isConnected === true && currentVideoId() === watchedVideoId) {
      return;
    }
    scheduleReconcile();
  }).observe(document.body, { childList: true, subtree: true });
};

chrome.runtime.onMessage.addListener((message) => {
  if (!isButtonStateChanged(message) || button === null) {
    return;
  }
  if (message.videoId === null || message.videoId === watchedVideoId) {
    button.setState(message.state);
  }
});

window.addEventListener("yt-navigate-finish", () => scheduleReconcile());
// The visible action row changes at YouTube's breakpoints, which can strand the button
// in a copy that is no longer the one on screen.
window.addEventListener("resize", () => scheduleReconcile(RESIZE_DELAY_MS));

reconcile();
observeRebuilds();
