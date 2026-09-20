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
// Long enough that a slow panel is not cut off, short enough that a press nothing
// answered does not sit there claiming to be working.
const CONFIRM_WITHIN_MS = 10_000;

let button: OverviewButton | null = null;
let watchedVideoId: string | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

const currentVideoId = (): string | null =>
  window.location.pathname === "/watch"
    ? new URL(window.location.href).searchParams.get("v")
    : null;

// Every state the button is told about arrives here, which is also where waiting for a
// press to be answered stops.
function applyState(state: ButtonState): void {
  if (confirmTimer !== null) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }
  button?.setState(state);
}

async function readState(videoId: string): Promise<void> {
  try {
    const state = (await chrome.runtime.sendMessage({
      type: BridgeMessage.READ_BUTTON_STATE,
      videoId,
    })) as ButtonState | undefined;
    if (state && videoId === watchedVideoId) {
      applyState(state);
    }
  } catch {
    // The worker is asleep or the extension was reloaded under us. Idle is the honest
    // answer: it offers the run rather than claiming anything about one.
    applyState(IDLE_BUTTON_STATE);
  }
}

function press(): void {
  if (button === null) {
    return;
  }

  // A ready button is opening the note the library already holds, not starting work, so
  // it says nothing new. Otherwise the spinner shows at once so the press does not read
  // as a miss — but with no startedAt, because nothing has started yet and a clock
  // ticking on a press that was declined would be timing a run that does not exist. The
  // clock begins when the panel reports the run's own startedAt
  // (docs/features/injected-button.md).
  const showedPending = button.kind !== "ready";
  if (showedPending) {
    button.setState({ kind: "generating", startedAt: null, progressFraction: 0 });

    const videoId = watchedVideoId;
    confirmTimer = setTimeout(() => {
      confirmTimer = null;
      if (videoId !== null && videoId === watchedVideoId) {
        void readState(videoId);
      }
    }, CONFIRM_WITHIN_MS);
  }

  void chrome.runtime
    .sendMessage({ type: BridgeMessage.REQUEST_OVERVIEW, videoUrl: window.location.href })
    // Only what this press put up comes back down. A ready button whose message failed
    // is still ready — the note is in the library either way.
    .catch(() => {
      if (showedPending) {
        applyState(IDLE_BUTTON_STATE);
      }
    });
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
    applyState(IDLE_BUTTON_STATE);
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
    applyState(message.state);
  }
});

window.addEventListener("yt-navigate-finish", () => scheduleReconcile());
// The visible action row changes at YouTube's breakpoints, which can strand the button
// in a copy that is no longer the one on screen.
window.addEventListener("resize", () => scheduleReconcile(RESIZE_DELAY_MS));

reconcile();
observeRebuilds();
