import { ReadingPositions } from "./types/ReadingPosition.js";
import {
  forgetReadingPositionIn,
  readingPositionFor,
  rememberReadingPosition,
} from "./util/readingPositions.js";

const STORAGE_KEY = "overview.readingPositions.v1";

// Every read and write is allowed to fail quietly: a browser that refuses site data
// costs the reader a convenience, not the transcript (docs/features/reading-position.md).
function readAll(storage: Storage): ReadingPositions {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return ReadingPositions.safeParse(JSON.parse(raw)).data ?? [];
  } catch {
    return [];
  }
}

function writeAll(positions: ReadingPositions, storage: Storage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // see above
  }
}

export function readReadingPosition(
  videoId: string,
  storage: Storage = globalThis.localStorage,
): number | null {
  return readingPositionFor(readAll(storage), videoId);
}

export function writeReadingPosition(
  videoId: string,
  startMs: number,
  storage: Storage = globalThis.localStorage,
): void {
  writeAll(rememberReadingPosition(readAll(storage), videoId, startMs), storage);
}

export function forgetReadingPosition(
  videoId: string,
  storage: Storage = globalThis.localStorage,
): void {
  const positions = readAll(storage);
  if (readingPositionFor(positions, videoId) !== null) {
    writeAll(forgetReadingPositionIn(positions, videoId), storage);
  }
}
