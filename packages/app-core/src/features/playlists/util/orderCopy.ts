import type { PlaylistOrder } from "@overview/domain";
import { formatCount } from "./tokenEstimate.js";

export const ORDER_LABEL: Record<PlaylistOrder, string> = {
  oldestFirst: "Oldest first",
  newestFirst: "Newest first",
  playlistOrder: "The playlist’s order",
};

const ORDER_IN_A_SENTENCE: Record<PlaylistOrder, string> = {
  oldestFirst: "oldest first",
  newestFirst: "newest first",
  playlistOrder: "in the playlist’s order",
};

// The preview already counts what will be made, so the order says only what it means.
const ORDER_MEANING: Record<PlaylistOrder, string> = {
  oldestFirst: "The one you added longest ago is made first.",
  newestFirst: "The one you added most recently is made first.",
  playlistOrder: "Made from the top of the playlist down, however you have arranged it.",
};

export const orderInASentence = (order: PlaylistOrder): string => {
  return ORDER_IN_A_SENTENCE[order];
};

export const orderMeaning = (order: PlaylistOrder): string => {
  return ORDER_MEANING[order];
};

export const orderWaitEffect = (order: PlaylistOrder, waiting: number): string => {
  if (waiting === 0) {
    return ORDER_MEANING[order];
  }
  return `The ${formatCount(waiting)} waiting are made ${ORDER_IN_A_SENTENCE[order]}`;
};

export const orderChangedLine = (order: PlaylistOrder, waiting: number): string => {
  const now = `Now ${ORDER_IN_A_SENTENCE[order]}.`;
  if (waiting === 0) {
    return now;
  }
  return `${now} The ${formatCount(waiting)} waiting are back in order.`;
};
