import { ReadingPositions } from "./types/ReadingPosition.js";
import { forgetReadingPositionIn, readingPositionFor, rememberReadingPosition } from "./util/readingPositions.js";

const STORAGE_KEY = "overview.readingPositions.v1";

const storageKeyFor = (accountId: string | null): string => (accountId === null ? STORAGE_KEY : `${STORAGE_KEY}.${accountId}`);

// Why it fails quietly: docs/features/reading-position.md, "Where it lives, and for how long".
const readAll = (accountId: string | null, storage: Storage): ReadingPositions => {
  try {
    const raw = storage.getItem(storageKeyFor(accountId));
    if (!raw) {
      return [];
    }
    return ReadingPositions.safeParse(JSON.parse(raw)).data ?? [];
  } catch {
    return [];
  }
};

const writeAll = (positions: ReadingPositions, accountId: string | null, storage: Storage): void => {
  try {
    storage.setItem(storageKeyFor(accountId), JSON.stringify(positions));
  } catch {}
};

export const readReadingPosition = (
  videoId: string,
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): number | null => {
  return readingPositionFor(readAll(accountId, storage), videoId);
};

export const writeReadingPosition = (
  videoId: string,
  startMs: number,
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): void => {
  writeAll(rememberReadingPosition(readAll(accountId, storage), videoId, startMs), accountId, storage);
};

export const forgetReadingPosition = (videoId: string, accountId: string | null, storage: Storage = globalThis.localStorage): void => {
  const positions = readAll(accountId, storage);
  if (readingPositionFor(positions, videoId) !== null) {
    writeAll(forgetReadingPositionIn(positions, videoId), accountId, storage);
  }
};

export const moveReadingPositions = (
  videoIds: readonly string[],
  toAccountId: string,
  storage: Storage = globalThis.localStorage,
): void => {
  for (const videoId of videoIds) {
    const startMs = readReadingPosition(videoId, null, storage);
    if (startMs === null) {
      continue;
    }
    if (readReadingPosition(videoId, toAccountId, storage) === null) {
      writeReadingPosition(videoId, startMs, toAccountId, storage);
    }
    forgetReadingPosition(videoId, null, storage);
  }
};

// For an install signed in before accounts had libraries: every place it kept was the account's.
export const adoptReadingPositions = (accountId: string, storage: Storage = globalThis.localStorage): void => {
  const positions = readAll(null, storage);
  if (positions.length === 0) {
    return;
  }
  for (const { videoId, startMs } of [...positions].reverse()) {
    if (readReadingPosition(videoId, accountId, storage) === null) {
      writeReadingPosition(videoId, startMs, accountId, storage);
    }
  }
  writeAll([], null, storage);
};

export const forgetReadingPositions = (accountId: string, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.removeItem(storageKeyFor(accountId));
  } catch {}
};
