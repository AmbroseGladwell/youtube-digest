import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparisonPaths } from "../comparisonPaths.js";
import { ChatQuestionSet } from "./ChatQuestion.js";

export interface ChatSource {
  overviewId: string;
  chosenFor: string;
}

// docs/architecture/in-app-chat.md, "The sources".
export const CHAT_SOURCES: readonly ChatSource[] = [
  { overviewId: "41cc60f4-40ec-43e8-9ed4-f90f79bae944", chosenFor: "10 min narrated explainer with studies, health" },
  { overviewId: "7f10c0dc-87f5-42fe-a9cd-acf7488e2db7", chosenFor: "conference talk with case studies, business" },
  { overviewId: "e915ef34-3699-4ff7-88e1-864ef3bec371", chosenFor: "screen-recorded tutorial, tech" },
  { overviewId: "da269435-dc2e-4ac9-b3e4-70dbf1f3a0de", chosenFor: "72 min podcast interview, business" },
  { overviewId: "fe081475-a40b-44d5-9a59-0ee32069ffaf", chosenFor: "80 min podcast interview, parenting, judged dubious" },
  { overviewId: "830813bf-1fbc-46ce-86ed-704c1ff8cf1e", chosenFor: "89 min long interview, politics, judged dubious" },
];

export const chatSourceDirectory = (overviewId: string) => join(comparisonPaths.chat, "sources", overviewId);

export const videoIdInOverview = (markdown: string): string | null =>
  /https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/.exec(markdown)?.[1] ?? null;

export interface LoadedChatSource extends ChatSource {
  overview: string;
  fetched: FetchedTranscript;
  questions: ChatQuestionSet;
}

export const loadChatSource = async (source: ChatSource): Promise<LoadedChatSource> => {
  const directory = chatSourceDirectory(source.overviewId);
  const read = (file: string) => readFile(join(directory, file), "utf-8");
  const [overview, transcript, questions] = await Promise.all([read("overview.md"), read("transcript.json"), read("questions.json")]);
  return {
    ...source,
    overview,
    fetched: JSON.parse(transcript) as FetchedTranscript,
    questions: ChatQuestionSet.parse(JSON.parse(questions)),
  };
};
