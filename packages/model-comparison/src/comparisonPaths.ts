import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { FetchedTranscript } from "@overview/transcripts";
import { videoLengthMs } from "./summariseRuns.js";

const dataDirectory = fileURLToPath(new URL("../.local/", import.meta.url));

export const comparisonPaths = {
  transcripts: join(dataDirectory, "transcripts"),
  run: (name: string) => join(dataDirectory, "runs", name),
};

export async function loadTranscripts(): Promise<FetchedTranscript[]> {
  const files = await readdir(comparisonPaths.transcripts).catch(() => []);
  const loaded = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(comparisonPaths.transcripts, file), "utf-8")) as FetchedTranscript),
  );
  return loaded.sort((left, right) => videoLengthMs(left) - videoLengthMs(right));
}
