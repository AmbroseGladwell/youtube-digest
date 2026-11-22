import type { Overview } from "@overview/domain";
import type { ListenPick, ListenPreference, ListenSide } from "./ListenPick.js";
import type { RunRecord } from "./RunRecord.js";

export interface ListenPair {
  videoId: string;
  old: Overview;
  new: Overview;
}

const passed = (record: RunRecord): record is RunRecord & { overview: Overview } =>
  (record.outcome === "passed-first" || record.outcome === "passed-after-retry") && record.overview !== null;

const latestPassedByVideo = (runs: readonly RunRecord[]): Map<string, Overview> => {
  const latest = new Map<string, RunRecord & { overview: Overview }>();
  for (const record of runs.filter(passed)) {
    const held = latest.get(record.videoId);
    if (held === undefined || record.startedAt > held.startedAt) {
      latest.set(record.videoId, record);
    }
  }
  return new Map([...latest].map(([videoId, record]) => [videoId, record.overview]));
};

export const listenPairs = (oldRuns: readonly RunRecord[], newRuns: readonly RunRecord[], order: readonly string[]): ListenPair[] => {
  const olds = latestPassedByVideo(oldRuns);
  const news = latestPassedByVideo(newRuns);
  return order.flatMap((videoId) => {
    const old = olds.get(videoId);
    const fresh = news.get(videoId);
    return old === undefined || fresh === undefined ? [] : [{ videoId, old, new: fresh }];
  });
};

export const nextListenPair = (pairs: readonly ListenPair[], picks: readonly ListenPick[]): ListenPair | null =>
  pairs.find((pair) => !picks.some((pick) => pick.videoId === pair.videoId)) ?? null;

export const preferenceOf = (side: ListenSide, newWasA: boolean): ListenPreference => {
  if (side === "tie") {
    return "tie";
  }
  return (side === "A") === newWasA ? "new" : "old";
};
