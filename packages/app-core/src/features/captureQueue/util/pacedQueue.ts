import { paceDailyLimit, queueOriginOf, type PlaylistPace, type QueuedCapture } from "@overview/domain";

export interface PacedQueue {
  ready: QueuedCapture[];
  tomorrow: QueuedCapture[];
  forYou: QueuedCapture[];
}

// What a pace holds back: docs/features/capture-queue.md, "Waiting on a pace".
export const pacedQueue = (
  waiting: readonly QueuedCapture[],
  paceOf: (capture: QueuedCapture) => PlaylistPace,
  madeToday: (capture: QueuedCapture) => number,
): PacedQueue => {
  const chosen = waiting.filter((capture) => capture.chosenAt !== null);
  const ready: QueuedCapture[] = [];
  const tomorrow: QueuedCapture[] = [];
  const forYou: QueuedCapture[] = [];
  const takenToday = new Map<string, number>();

  for (const capture of waiting) {
    if (capture.chosenAt !== null) {
      continue;
    }
    const limit = paceDailyLimit(paceOf(capture));
    if (limit === 0) {
      forYou.push(capture);
      continue;
    }
    const playlistId = queueOriginOf(capture).id;
    const taken = takenToday.get(playlistId) ?? madeToday(capture);
    if (limit !== null && taken >= limit) {
      tomorrow.push(capture);
      continue;
    }
    takenToday.set(playlistId, taken + 1);
    ready.push(capture);
  }

  return { ready: [...chosen, ...ready], tomorrow, forYou };
};
