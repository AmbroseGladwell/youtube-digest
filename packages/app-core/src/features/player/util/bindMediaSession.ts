import type { PlayerEngine } from "../PlayerEngine.js";
import { SKIP_SECONDS } from "../PlayerEngine.js";

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
    ["play", () => engine.play()],
    ["pause", () => engine.pause()],
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
  for (const [action, handler] of handlers) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // A browser that does not know an action refuses it; the rest still work.
    }
  }

  const stopState = engine.subscribe(update);
  const stopTime = engine.subscribeTime(() => {
    if (Date.now() - lastReport >= POSITION_REPORT_MS) reportPosition();
  });
  update();

  return () => {
    stopState();
    stopTime();
    for (const [action] of handlers) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // As above.
      }
    }
  };
}
