import { paceDailyLimit, type PlaylistPace, type QueuedCapture } from "@overview/domain";

export interface PacedQueue {
  // What the queue can make now: the videos the reader chose first, then each playlist's
  // oldest up to what its pace has left today.
  ready: QueuedCapture[];
  // Past its playlist's pace for today.
  tomorrow: QueuedCapture[];
  // From a playlist made only when the reader chooses.
  forYou: QueuedCapture[];
}

// A pace holds only its own playlist's videos; everything else carries on in its place, and
// a video the reader chose never waits on its pace (docs/features/capture-queue.md,
// "Waiting on a pace").
export function pacedQueue(
  waiting: readonly QueuedCapture[],
  paceOf: (capture: QueuedCapture) => PlaylistPace,
  madeToday: (capture: QueuedCapture) => number,
): PacedQueue {
  const chosen = waiting.filter((capture) => capture.chosenAt !== null);
  const ready: QueuedCapture[] = [];
  const tomorrow: QueuedCapture[] = [];
  const forYou: QueuedCapture[] = [];
  const takenToday = new Map<string, number>();

  for (const capture of waiting) {
    if (capture.chosenAt !== null) continue;
    const limit = paceDailyLimit(paceOf(capture));
    if (limit === 0) {
      forYou.push(capture);
      continue;
    }
    const playlistId = capture.fromPlaylist.id;
    const taken = takenToday.get(playlistId) ?? madeToday(capture);
    if (limit !== null && taken >= limit) {
      tomorrow.push(capture);
      continue;
    }
    takenToday.set(playlistId, taken + 1);
    ready.push(capture);
  }

  return { ready: [...chosen, ...ready], tomorrow, forYou };
}
