import { NARRATION_PLAYLIST_TYPE } from "@overview/domain";
import type { LoadStream } from "../PlayerEngine.js";

// Safari plays HLS itself, locked screen included; elsewhere hls.js is fetched on the first stream.
export const loadStreamWithHls: LoadStream = (media, url, shouldPlay) => {
  const element = media as HTMLMediaElement;
  if (element.canPlayType(NARRATION_PLAYLIST_TYPE) !== "") {
    element.src = url;
    return () => undefined;
  }
  const loading = { released: false, destroy: () => undefined as void };
  void import("hls.js").then(({ default: Hls }) => {
    if (loading.released) {
      return;
    }
    if (!Hls.isSupported()) {
      element.src = url;
      return;
    }
    const hls = new Hls({ enableWorker: false, startPosition: 0 });
    loading.destroy = () => hls.destroy();
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (shouldPlay()) {
        element.play().catch(() => undefined);
      }
    });
    hls.loadSource(url);
    hls.attachMedia(element);
  });
  return () => {
    loading.released = true;
    loading.destroy();
  };
};
