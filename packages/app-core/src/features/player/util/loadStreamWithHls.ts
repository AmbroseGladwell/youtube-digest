import { NARRATION_PLAYLIST_TYPE } from "@overview/domain";
import type { LoadStream } from "../PlayerEngine.js";

// Chromium now says it plays HLS too, but only Safari's own player is proven on these segments and a locked screen.
const isChromium = (): boolean =>
  (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands.some(
    ({ brand }) => brand === "Chromium",
  ) ?? false;

// Safari plays HLS itself, locked screen included; elsewhere hls.js is fetched on the first stream.
export const loadStreamWithHls: LoadStream = (media, url, shouldPlay) => {
  const element = media as HTMLMediaElement;
  if (element.canPlayType(NARRATION_PLAYLIST_TYPE) !== "" && !isChromium()) {
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
