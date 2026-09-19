import { isYouTubeUrl, type PlaybackPosition, type PlaybackSource } from "@overview/app-core";
import { isPlaybackReport, PLAYBACK_REPORT } from "./playbackReport.js";

// Where the transcript's "follow playback" gets its position from
// (docs/features/following-playback.md). The player is in the page, so something of ours
// has to be in the page too — but only while the panel is open on a video, and only to
// read `currentTime` off the <video> element and hand it back.
let position: PlaybackPosition | null = null;
const listeners = new Set<() => void>();

const REPORT_EVERY_MS = 400;

function publish(next: PlaybackPosition | null): void {
  position = next;
  for (const listener of listeners) listener();
}

// Serialized and run in the tab, so it closes over nothing and reads its own constants
// from the arguments (docs/features/following-playback.md).
function reportPlayback(reportType: string, everyMs: number): void {
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
      // Nothing is listening any more: the panel closed, or left the transcript. The
      // reporter takes itself down rather than posting to no one for the life of the
      // page, and a later injection puts it back.
      .catch(() => page.__overviewPlaybackStop__?.());
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

async function injectIntoActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? tab?.pendingUrl;
  if (tab?.id === undefined || url === undefined || !isYouTubeUrl(url)) {
    publish(null);
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: reportPlayback,
      args: [PLAYBACK_REPORT, REPORT_EVERY_MS],
    });
  } catch {
    // No host permission for this page, or it went away mid-injection. Reporting
    // nothing is the same as a shell that cannot see a player at all.
    publish(null);
  }
}

const onMessage = (message: unknown) => {
  if (!isPlaybackReport(message)) {
    return;
  }
  const { videoId, positionMs, playing } = message;
  publish({ videoId, positionMs, playing });
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
