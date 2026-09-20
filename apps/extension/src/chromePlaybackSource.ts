import { isYouTubeUrl, type PlaybackPosition, type PlaybackSource } from "@overview/app-core";
import { isPlaybackReport, PLAYBACK_REPORT } from "./playbackReport.js";

// Where the transcript's "follow playback" gets its position from
// (docs/features/following-playback.md). The player is in the page, so something of ours
// has to be in the page too — but only while the panel is open on a video, and only to
// read `currentTime` off the <video> element and hand it back.
let position: PlaybackPosition | null = null;
const listeners = new Set<() => void>();

const REPORT_EVERY_MS = 400;
// Roughly two seconds of timeupdates with nobody answering.
const GIVE_UP_AFTER_MISSES = 5;

function publish(next: PlaybackPosition | null): void {
  position = next;
  for (const listener of listeners) listener();
}

// Serialized and run in the tab, so it closes over nothing and reads its own constants
// from the arguments (docs/features/following-playback.md).
function reportPlayback(reportType: string, everyMs: number, giveUpAfter: number): void {
  interface Reporting {
    __overviewPlaybackStop__?: () => void;
  }
  const page = window as Window & Reporting;

  // YouTube's own class for the main player. A watch page can hold several <video>
  // elements — an ad, a hovered preview — and the first one is not reliably the one
  // being watched. The fallback is for the day that class is renamed.
  const mainVideo = () =>
    document.querySelector<HTMLVideoElement>("video.html5-main-video") ??
    document.querySelector("video");

  let lastSentAt = 0;
  let unacknowledged = 0;
  const send = (force: boolean) => {
    const video = mainVideo();
    const videoId = new URL(window.location.href).searchParams.get("v");
    if (!video || videoId === null) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastSentAt < everyMs) {
      return;
    }
    lastSentAt = now;
    void chrome.runtime
      .sendMessage({
        type: reportType,
        videoId,
        positionMs: Math.floor(video.currentTime * 1000),
        playing: !video.paused,
      })
      // Counted rather than inferred from the send failing: the extension has other
      // runtime listeners, and whether an unanswered message rejects or resolves depends
      // on which of them happen to be alive. An explicit acknowledgement from the reader
      // is the only reliable sign anyone is still listening
      // (docs/features/following-playback.md).
      .then((acknowledged) => {
        unacknowledged = acknowledged === true ? 0 : unacknowledged + 1;
      })
      .catch(() => {
        unacknowledged += 1;
      })
      .finally(() => {
        if (unacknowledged >= giveUpAfter) {
          page.__overviewPlaybackStop__?.();
        }
      });
  };

  // Always, even when the listeners are already attached: a paused video emits no
  // timeupdate, so a panel opening on one — or coming back to the tab — would otherwise
  // see nothing at all until somebody pressed play.
  send(true);

  if (page.__overviewPlaybackStop__) {
    return;
  }

  const onTick = () => send(false);
  const onJump = () => send(true);
  const jumps = ["play", "pause", "seeked"];

  document.addEventListener("timeupdate", onTick, { capture: true });
  for (const jump of jumps) document.addEventListener(jump, onJump, { capture: true });

  page.__overviewPlaybackStop__ = () => {
    document.removeEventListener("timeupdate", onTick, true);
    for (const jump of jumps) document.removeEventListener(jump, onJump, true);
    delete page.__overviewPlaybackStop__;
  };
}

// Serialized into the tab like the reporter above, and the only thing here that writes
// to the page. It sets one property on the player and reads nothing
// (docs/features/following-playback.md).
function seekPlayback(positionMs: number): void {
  const video =
    document.querySelector<HTMLVideoElement>("video.html5-main-video") ??
    document.querySelector("video");
  if (video) {
    video.currentTime = positionMs / 1000;
  }
}

async function activeYouTubeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? tab?.pendingUrl;
  if (tab?.id === undefined || url === undefined || !isYouTubeUrl(url)) {
    return null;
  }
  return tab.id;
}

async function seekInActiveTab(positionMs: number): Promise<void> {
  const tabId = await activeYouTubeTabId();
  if (tabId === null) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: seekPlayback,
      args: [positionMs],
    });
  } catch {
    // No host permission for this page, or it went away mid-seek. The video simply does
    // not move; the range beside the button is still there to navigate by.
  }
}

async function injectIntoActiveTab(): Promise<void> {
  const tabId = await activeYouTubeTabId();
  if (tabId === null) {
    publish(null);
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: reportPlayback,
      args: [PLAYBACK_REPORT, REPORT_EVERY_MS, GIVE_UP_AFTER_MISSES],
    });
  } catch {
    // No host permission for this page, or it went away mid-injection. Reporting
    // nothing is the same as a shell that cannot see a player at all.
    publish(null);
  }
}

const onMessage = (
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  respond: (ack: boolean) => void,
) => {
  if (!isPlaybackReport(message)) {
    return;
  }
  const { videoId, positionMs, playing } = message;
  publish({ videoId, positionMs, playing });
  respond(true);
};

const onActivated = () => {
  publish(null);
  void injectIntoActiveTab();
};

const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") {
    publish(null);
    void injectIntoActiveTab();
  }
};

export const chromePlaybackSource: PlaybackSource = {
  getPosition: () => position,

  seekTo: (positionMs) => void seekInActiveTab(positionMs),
  subscribe: (onChange) => {
    listeners.add(onChange);
    if (listeners.size === 1) {
      chrome.runtime.onMessage.addListener(onMessage);
      chrome.tabs.onActivated.addListener(onActivated);
      chrome.tabs.onUpdated.addListener(onUpdated);
      void injectIntoActiveTab();
    }

    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        chrome.runtime.onMessage.removeListener(onMessage);
        chrome.tabs.onActivated.removeListener(onActivated);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        publish(null);
      }
    };
  },
};
