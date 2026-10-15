import { jsonRecordStore, safePathPart, type RecordStore } from "./jsonRecordStore.js";
import type { BlindPick } from "./BlindPick.js";
import type { JudgeRecord } from "./JudgeRecord.js";

export const judgmentStore = (directory: string): RecordStore<JudgeRecord> =>
  jsonRecordStore<JudgeRecord>(directory, (record) => `${safePathPart(record.candidate)}/${safePathPart(record.videoId)}.json`);

export const pickStore = (directory: string): RecordStore<BlindPick> =>
  jsonRecordStore<BlindPick>(directory, (pick) => `${safePathPart(pick.candidate)}/${safePathPart(pick.videoId)}.json`);
