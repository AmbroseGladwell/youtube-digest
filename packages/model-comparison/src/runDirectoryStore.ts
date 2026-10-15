import { jsonRecordStore, safePathPart, type RecordStore } from "./jsonRecordStore.js";
import type { RunRecord } from "./RunRecord.js";

export const runDirectoryStore = (directory: string): RecordStore<RunRecord> =>
  jsonRecordStore<RunRecord>(
    directory,
    (record) => `${safePathPart(record.provider)}__${safePathPart(record.model)}/${safePathPart(record.videoId)}.json`,
  );
