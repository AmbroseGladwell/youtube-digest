import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface RecordStore<T> {
  all(): Promise<T[]>;
  save(record: T): Promise<void>;
}

export const safePathPart = (part: string): string => part.replace(/[^\w.-]/g, "_");

// One JSON file per record, in one folder per group, so a record can be read on its own
// and a run that dies halfway keeps everything it finished.
export function jsonRecordStore<T>(directory: string, pathOf: (record: T) => string): RecordStore<T> {
  return {
    async all() {
      const groups = await readdir(directory, { withFileTypes: true }).catch(() => []);
      const records: T[] = [];
      for (const group of groups.filter((entry) => entry.isDirectory())) {
        for (const file of await readdir(join(directory, group.name))) {
          if (file.endsWith(".json")) {
            records.push(JSON.parse(await readFile(join(directory, group.name, file), "utf-8")) as T);
          }
        }
      }
      return records;
    },
    async save(record) {
      const path = join(directory, pathOf(record));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
    },
  };
}
