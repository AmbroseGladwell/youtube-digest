import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunStore } from "./runComparison.js";
import type { RunRecord } from "./RunRecord.js";

const safe = (part: string) => part.replace(/[^\w.-]/g, "_");

export const runRecordPath = (directory: string, record: Pick<RunRecord, "provider" | "model" | "videoId">): string =>
  join(directory, `${safe(record.provider)}__${safe(record.model)}`, `${safe(record.videoId)}.json`);

export function runDirectoryStore(directory: string): RunStore {
  return {
    async all() {
      const models = await readdir(directory, { withFileTypes: true }).catch(() => []);
      const records: RunRecord[] = [];
      for (const model of models.filter((entry) => entry.isDirectory())) {
        for (const file of await readdir(join(directory, model.name))) {
          if (file.endsWith(".json")) {
            records.push(JSON.parse(await readFile(join(directory, model.name, file), "utf-8")) as RunRecord);
          }
        }
      }
      return records;
    },
    async save(record) {
      const path = runRecordPath(directory, record);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
    },
  };
}
