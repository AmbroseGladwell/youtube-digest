import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AudioStore } from "./AudioStore.js";

export function createFileAudioStore(dir: string): AudioStore {
  const fileFor = (key: string) => path.join(dir, `${key}.m4a`);
  return {
    async put(key, audio) {
      await mkdir(dir, { recursive: true });
      const partial = `${fileFor(key)}.part`;
      await writeFile(partial, audio);
      await rename(partial, fileFor(key));
    },
    async get(key) {
      try {
        return await readFile(fileFor(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
  };
}
