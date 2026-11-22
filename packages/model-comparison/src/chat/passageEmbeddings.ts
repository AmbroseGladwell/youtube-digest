import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { comparisonPaths } from "../comparisonPaths.js";
import { embedTexts, type Embedded } from "./embedTexts.js";
import type { Passage } from "./transcriptPassages.js";

const cached = async (path: string, make: () => Promise<Embedded>): Promise<Embedded> => {
  const stored = await readFile(path, "utf-8").then(
    (text) => JSON.parse(text) as Embedded,
    () => null,
  );
  if (stored !== null) {
    return stored;
  }
  const made = await make();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(made));
  return made;
};

export const passageEmbeddings = (apiKey: string, overviewId: string, windowMs: number, passages: readonly Passage[]) =>
  cached(join(comparisonPaths.chat, "embeddings", `${overviewId}-window-${windowMs / 1000}s.json`), () =>
    embedTexts(
      apiKey,
      passages.map((passage) => passage.text),
    ),
  );

export const questionEmbeddings = (apiKey: string, overviewId: string, questions: readonly string[]) =>
  cached(join(comparisonPaths.chat, "embeddings", `${overviewId}-questions.json`), () => embedTexts(apiKey, questions));
