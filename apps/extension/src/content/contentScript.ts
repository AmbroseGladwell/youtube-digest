import { DEFAULT_ACCENT_COLOUR, type AccentColour } from "@overview/domain/accentPalette";
import { onAccentColourChanged, readAccentColour } from "../accentColourStorage.js";
import { BridgeMessage, IDLE_BUTTON_STATE, isButtonStateChanged, type ButtonState } from "../overviewBridge.js";
import { OverviewButton } from "./OverviewButton.js";
import { findOverviewButtonHost } from "./overviewButtonHost.js";
import { OVERVIEW_BUTTON_ID } from "./overviewButtonStyles.js";

const RECONCILE_DELAY_MS = 80;
const RESIZE_DELAY_MS = 120;
// Long enough for a slow panel, short enough that an unanswered press doesn't claim to be working.
const CONFIRM_WITHIN_MS = 10_000;

let button: OverviewButton | null = null;
let accentColour: AccentColour = DEFAULT_ACCENT_COLOUR;
let watchedVideoId: string | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

const currentVideoId = (): string | null =>
  window.location.pathname === "/watch" ? new URL(window.location.href).searchParams.get("v") : null;

const applyState = (state: ButtonState): void => {
  if (confirmTimer !== null) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }
  button?.setState(state);
};

const readState = async (videoId: string): Promise<void> => {
  try {
    const state = (await chrome.runtime.sendMessage({
      type: BridgeMessage.READ_BUTTON_STATE,
      videoId,
    })) as ButtonState | undefined;
    if (state && videoId === watchedVideoId) {
      applyState(state);
    }
  } catch {
    // The worker is asleep or the extension reloaded; idle offers the run rather than claiming one.
    applyState(IDLE_BUTTON_STATE);
  }
};

const press = (): void => {
  if (button === null) {
    return;
  }

  // docs/features/injected-button.md, "Four states, and where each one's facts come from".
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
    // Only what this press put up comes back down; a ready button stays ready.
    .catch(() => {
      if (showedPending) {
        applyState(IDLE_BUTTON_STATE);
      }
    });
};

const reconcile = (): void => {
  const videoId = currentVideoId();

  if (videoId === null) {
    for (const stale of document.querySelectorAll(`#${OVERVIEW_BUTTON_ID}`)) {
      stale.remove();
    }
    button = null;
    watchedVideoId = null;
    return;
  }

  const host = findOverviewButtonHost();
  if (host === null) {
    return;
  }

  if (button === null || !button.element.isConnected) {
    for (const stale of document.querySelectorAll(`#${OVERVIEW_BUTTON_ID}`)) {
      stale.remove();
    }
    button = new OverviewButton(press);
    button.setAccentColour(accentColour);
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
};

const scheduleReconcile = (delay: number = RECONCILE_DELAY_MS): void => {
  if (reconcileTimer !== null) {
    clearTimeout(reconcileTimer);
  }
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    reconcile();
  }, delay);
};

// The early-out matters: YouTube mutates the watch page constantly.
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
// The visible action row changes at YouTube's breakpoints, which can strand the button in a hidden copy.
window.addEventListener("resize", () => scheduleReconcile(RESIZE_DELAY_MS));

reconcile();
observeRebuilds();

const followAccentColour = async (): Promise<void> => {
  accentColour = await readAccentColour();
  button?.setAccentColour(accentColour);
};

void followAccentColour();
onAccentColourChanged(() => void followAccentColour());
