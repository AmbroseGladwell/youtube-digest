import type { RunRecord } from "./RunRecord.js";
import { isPassed } from "./summariseRuns.js";

export type ActionsByReader = ReadonlyMap<string, readonly string[]>;

export interface PairSpread {
  left: string;
  right: string;
  videos: number;
  identical: number;
  bothEmpty: number;
  meanWordOverlap: number | null;
}

export interface ReaderSpread {
  videos: number;
  sameForEveryone: number;
  pairs: PairSpread[];
  itemCounts: Record<string, [number, number, number, number]>;
}

const normalised = (action: string) => action.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const wordsOf = (actions: readonly string[]) => new Set(actions.flatMap((action) => normalised(action).split(" ")).filter((word) => word !== ""));

export const sameActions = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((action, index) => normalised(action) === normalised(right[index]!));

// Jaccard over the words of every action: 1 is the same words, 0 none shared.
export function wordOverlap(left: readonly string[], right: readonly string[]): number {
  const leftWords = wordsOf(left);
  const rightWords = wordsOf(right);
  if (leftWords.size === 0 && rightWords.size === 0) return 1;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / (leftWords.size + rightWords.size - shared);
}

// A video counts only once every reader's overview passed, so each pair is compared over
// the same videos and a failure can't pass for a difference.
export function actionsByVideo(runs: ReadonlyMap<string, readonly RunRecord[]>): Map<string, ActionsByReader> {
  const readers = [...runs.keys()];
  const byVideo = new Map<string, Map<string, readonly string[]>>();
  for (const [name, records] of runs) {
    for (const record of records.filter(isPassed)) {
      if (record.overview === null) continue;
      const entry = byVideo.get(record.videoId) ?? new Map<string, readonly string[]>();
      entry.set(name, record.overview.howToApply?.items ?? []);
      byVideo.set(record.videoId, entry);
    }
  }
  return new Map([...byVideo].filter(([, actions]) => readers.every((name) => actions.has(name))));
}

// Two empty lists agree, but saying nothing to two readers is no evidence the context was
// ignored, so they are counted apart and left out of the overlap.
export function readerSpread(readers: readonly string[], byVideo: ReadonlyMap<string, ActionsByReader>): ReaderSpread {
  const videos = [...byVideo.values()];
  const pairs = readers.flatMap((left, index) =>
    readers.slice(index + 1).map((right): PairSpread => {
      const bothEmpty = videos.filter((actions) => actions.get(left)!.length === 0 && actions.get(right)!.length === 0);
      const overlaps = videos
        .filter((actions) => !bothEmpty.includes(actions))
        .map((actions) => wordOverlap(actions.get(left)!, actions.get(right)!));
      return {
        left,
        right,
        videos: videos.length,
        identical: videos.filter((actions) => sameActions(actions.get(left)!, actions.get(right)!)).length,
        bothEmpty: bothEmpty.length,
        meanWordOverlap: overlaps.length === 0 ? null : overlaps.reduce((total, overlap) => total + overlap, 0) / overlaps.length,
      };
    }),
  );
  const itemCounts = Object.fromEntries(
    readers.map((name) => {
      const counts: [number, number, number, number] = [0, 0, 0, 0];
      for (const actions of videos) counts[Math.min(actions.get(name)!.length, 3)]! += 1;
      return [name, counts];
    }),
  );
  return {
    videos: videos.length,
    sameForEveryone: videos.filter((actions) => readers.every((name) => sameActions(actions.get(name)!, actions.get(readers[0]!)!)))
      .length,
    pairs,
    itemCounts,
  };
}
