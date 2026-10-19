import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PROVIDERS, type Provider } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { judgmentStore, pickStore } from "./judgmentStore.js";
import { runDirectoryStore } from "./runDirectoryStore.js";
import { videoLengthMs } from "./summariseRuns.js";

const dataDirectory = fileURLToPath(new URL("../.local/", import.meta.url));

export const comparisonPaths = {
  transcripts: join(dataDirectory, "transcripts"),
  run: (name: string) => join(dataDirectory, "runs", name),
  judgments: (name: string) => join(dataDirectory, "judgments", name),
  picks: (name: string) => join(dataDirectory, "picks", name),
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

export async function loadComparison(runName: string) {
  const transcripts = await loadTranscripts();
  return {
    transcripts,
    byVideo: new Map(transcripts.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched])),
    runs: await runDirectoryStore(comparisonPaths.run(runName)).all(),
    judgments: await judgmentStore(comparisonPaths.judgments(runName)).all(),
    picks: await pickStore(comparisonPaths.picks(runName)).all(),
  };
}

export const providerKeysFromEnv = (): Partial<Record<Provider, string>> =>
  Object.fromEntries(
    PROVIDERS.flatMap((provider) => {
      const key = process.env[`${provider.toUpperCase()}_API_KEY`];
      return key ? [[provider, key]] : [];
    }),
  );
