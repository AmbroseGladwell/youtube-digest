import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AudioStore } from "./AudioStore.js";

const readIfThere = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const writeWhole = async (file: string, audio: Buffer): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const partial = `${file}.part`;
  await writeFile(partial, audio);
  await rename(partial, file);
};

export const createFileAudioStore = (dir: string): AudioStore => {
  const fileFor = (key: string) => path.join(dir, `${key}.m4a`);
  const segmentsOf = (key: string) => path.join(dir, `${key}.segments`);
  const segmentFor = (key: string, index: number) => path.join(segmentsOf(key), `${index}.aac`);
  return {
    put: (key, audio) => writeWhole(fileFor(key), audio),
    get: (key) => readIfThere(fileFor(key)),
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
    putSegment: (key, index, audio) => writeWhole(segmentFor(key, index), audio),
    getSegment: (key, index) => readIfThere(segmentFor(key, index)),
    async deleteSegments(key) {
      await rm(segmentsOf(key), { recursive: true, force: true });
    },
  };
};
