import { ReadingPositions } from "./types/ReadingPosition.js";
import {
  forgetReadingPositionIn,
  readingPositionFor,
  rememberReadingPosition,
} from "./util/readingPositions.js";

const STORAGE_KEY = "overview.readingPositions.v1";

const storageKeyFor = (accountId: string | null): string =>
  accountId === null ? STORAGE_KEY : `${STORAGE_KEY}.${accountId}`;

// Every read and write is allowed to fail quietly: a browser that refuses site data
// costs the reader a convenience, not the transcript (docs/features/reading-position.md).
function readAll(accountId: string | null, storage: Storage): ReadingPositions {
  try {
    const raw = storage.getItem(storageKeyFor(accountId));
    if (!raw) return [];
    return ReadingPositions.safeParse(JSON.parse(raw)).data ?? [];
  } catch {
    return [];
  }
}

function writeAll(positions: ReadingPositions, accountId: string | null, storage: Storage): void {
  try {
    storage.setItem(storageKeyFor(accountId), JSON.stringify(positions));
  } catch {
    // see above
  }
}

export function readReadingPosition(
  videoId: string,
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): number | null {
  return readingPositionFor(readAll(accountId, storage), videoId);
}

export function writeReadingPosition(
  videoId: string,
  startMs: number,
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): void {
  writeAll(rememberReadingPosition(readAll(accountId, storage), videoId, startMs), accountId, storage);
}

export function forgetReadingPosition(
  videoId: string,
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): void {
  const positions = readAll(accountId, storage);
  if (readingPositionFor(positions, videoId) !== null) {
    writeAll(forgetReadingPositionIn(positions, videoId), accountId, storage);
  }
}

// Where the reader had got to in the overviews the move on sign-in carried into an account
// goes with them, without replacing a place the account's library already holds.
export function moveReadingPositions(
  videoIds: readonly string[],
  toAccountId: string,
  storage: Storage = globalThis.localStorage,
): void {
  for (const videoId of videoIds) {
    const startMs = readReadingPosition(videoId, null, storage);
    if (startMs === null) continue;
    if (readReadingPosition(videoId, toAccountId, storage) === null) {
      writeReadingPosition(videoId, startMs, toAccountId, storage);
    }
    forgetReadingPosition(videoId, null, storage);
  }
}

// An install signed in before accounts had libraries of their own: every place it
// remembered was the account's, and moves under it with the library.
export function adoptReadingPositions(accountId: string, storage: Storage = globalThis.localStorage): void {
  const positions = readAll(null, storage);
  if (positions.length === 0) return;
  for (const { videoId, startMs } of [...positions].reverse()) {
    if (readReadingPosition(videoId, accountId, storage) === null) {
      writeReadingPosition(videoId, startMs, accountId, storage);
    }
  }
  writeAll([], null, storage);
}
