import { createHash } from "node:crypto";
import type { BlindChoice, BlindPick } from "./BlindPick.js";
import type { JudgeRecord } from "./JudgeRecord.js";
import { pairKey, type JudgingPair } from "./runJudging.js";

const videoIdOf = (pair: JudgingPair) => pair.fetched.video.id ?? pair.fetched.video.url;

// Pairs the judge has already decided come first, because a pick is only useful for
// calibration when there is a judgment to compare it with.
export function nextBlindPair(
  pairs: readonly JudgingPair[],
  picks: readonly BlindPick[],
  judgments: readonly JudgeRecord[],
  random: () => number = Math.random,
): JudgingPair | null {
  const picked = new Set(picks.map((pick) => pairKey(pick.videoId, pick.candidate)));
  const judged = new Set(
    judgments.filter((record) => record.outcome === "judged").map((record) => pairKey(record.videoId, record.candidate)),
  );
  const open = pairs.filter((pair) => !picked.has(pairKey(videoIdOf(pair), pair.candidate.name)));
  const preferred = open.filter((pair) => judged.has(pairKey(videoIdOf(pair), pair.candidate.name)));
  const pool = preferred.length > 0 ? preferred : open;
  return pool.length === 0 ? null : pool[Math.floor(random() * pool.length)]!;
}

export function blindPick(pair: JudgingPair, candidateWasA: boolean, choice: BlindChoice, pickedAt: string): BlindPick {
  return {
    videoId: videoIdOf(pair),
    baseline: pair.baseline.name,
    candidate: pair.candidate.name,
    candidateWasA,
    choice,
    result: choice === "tie" ? "tie" : (choice === "A") === candidateWasA ? "win" : "loss",
    pickedAt,
  };
}

export interface BlindSetOptions {
  candidates?: readonly string[] | undefined;
  limit?: number | undefined;
}

// A hash, not a shuffle, so the same flags offer the same pairs every time the page is
// started, and picks made in one sitting count towards the set in the next.
export function blindPairSet(pairs: readonly JudgingPair[], { candidates, limit }: BlindSetOptions): JudgingPair[] {
  const rank = (pair: JudgingPair) =>
    createHash("sha256").update(pairKey(videoIdOf(pair), pair.candidate.name)).digest("hex");
  return pairs
    .filter((pair) => candidates === undefined || candidates.includes(pair.candidate.name))
    .sort((left, right) => rank(left).localeCompare(rank(right)))
    .slice(0, limit ?? pairs.length);
}

export const isInSet = (set: readonly JudgingPair[], pick: BlindPick): boolean =>
  set.some((pair) => videoIdOf(pair) === pick.videoId && pair.candidate.name === pick.candidate);
