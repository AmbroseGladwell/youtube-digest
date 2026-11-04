import type { PlayerEngine } from "../PlayerEngine.js";
import { SKIP_SECONDS } from "../PlayerEngine.js";
import { currentMediaSessionOverride, onMediaSessionOverride } from "./mediaSessionOverride.js";

const POSITION_REPORT_MS = 5000;

// The lock screen, Now Playing and headphone buttons, which are designed through this
// rather than drawn (docs/features/audio-player.md). Seek ±15 s and no track buttons: iOS
// shows skip buttons only when there is no previous or next track to offer instead.
export function bindMediaSession(engine: PlayerEngine): () => void {
  const session = typeof navigator === "undefined" ? undefined : navigator.mediaSession;
  if (session === undefined || typeof MediaMetadata === "undefined") {
    return () => undefined;
  }

  let lastTrack: unknown = null;
  let lastReport = 0;

  const reportPosition = () => {
    const { timings, rate, source } = engine.getSnapshot();
    if (source !== "audio" || timings.durationSeconds <= 0 || typeof session.setPositionState !== "function") return;
    lastReport = Date.now();
    session.setPositionState({
      duration: timings.durationSeconds,
      playbackRate: rate,
      position: Math.min(engine.getTime(), timings.durationSeconds),
    });
  };

  const update = () => {
    const { track, status, source } = engine.getSnapshot();
    const override = currentMediaSessionOverride();
    if (override !== null && track !== null) {
      session.metadata = new MediaMetadata({ title: override.title, artist: override.artist, album: "The Overview" });
      session.playbackState = status === "playing" || status === "buffering" ? "playing" : "paused";
      lastTrack = null;
      return;
    }
    if (track === null || source !== "audio") {
      session.metadata = null;
      session.playbackState = "none";
      lastTrack = null;
      return;
    }
    if (track !== lastTrack) {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.channel,
        album: "The Overview",
        artwork: track.artworkUrl === null ? [] : [{ src: track.artworkUrl }],
      });
      lastTrack = track;
    }
    session.playbackState = status === "playing" || status === "buffering" ? "playing" : "paused";
    reportPosition();
  };

  const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
    ["play", () => (currentMediaSessionOverride()?.onPlay ?? (() => engine.play()))()],
    ["pause", () => (currentMediaSessionOverride()?.onPause ?? (() => engine.pause()))()],
    ["stop", () => engine.stop()],
    ["seekbackward", (details) => engine.skip(-(details.seekOffset ?? SKIP_SECONDS))],
    ["seekforward", (details) => engine.skip(details.seekOffset ?? SKIP_SECONDS)],
    ["seekto", (details) => {
      if (details.seekTime !== undefined) engine.seek(details.seekTime);
      reportPosition();
    }],
    ["previoustrack", null],
    ["nexttrack", null],
  ];
  const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // A browser that does not know an action refuses it; the rest still work.
    }
  };
  for (const [action, handler] of handlers) setHandler(action, handler);

  // Track buttons exist only while something gives them a meaning, so iOS keeps its skip buttons
  // the rest of the time.
  const applyOverride = () => {
    const override = currentMediaSessionOverride();
    setHandler("nexttrack", override === null ? null : () => override.onNext());
    setHandler("previoustrack", override === null ? null : () => override.onPrevious());
    update();
  };
  const stopOverride = onMediaSessionOverride(applyOverride);

  const stopState = engine.subscribe(update);
  const stopTime = engine.subscribeTime(() => {
    if (Date.now() - lastReport >= POSITION_REPORT_MS) reportPosition();
  });
  update();

  return () => {
    stopState();
    stopTime();
    stopOverride();
    for (const [action] of handlers) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // As above.
      }
    }
  };
}
