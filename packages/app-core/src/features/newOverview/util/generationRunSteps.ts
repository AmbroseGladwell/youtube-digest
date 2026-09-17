import type { NewOverviewRun } from "../types/NewOverviewRun.js";
import { overviewReadMinutes } from "./overviewReadMinutes.js";

export type GenerationStepState = "waiting" | "running" | "done";

export interface GenerationStep {
  number: string;
  label: string;
  detail: string;
  state: GenerationStepState;
}

export function generationRunSteps(run: NewOverviewRun): GenerationStep[] {
  const transcriptDone = run.transcriptWords !== null;
  const overviewDone = run.overview !== null;

  return [
    {
      number: "01",
      label: "Fetching transcript",
      detail: transcriptDone
        ? `Transcript fetched · ${run.transcriptWords!.toLocaleString("en-GB")} words`
        : "Reading captions from YouTube",
      state: transcriptDone ? "done" : "running",
    },
    {
      number: "02",
      label: "Creating overview",
      detail: overviewDone
        ? `Overview written · ${overviewReadMinutes(run.overview!)} min read`
        : transcriptDone
          ? "Summarising, scoring and filing"
          : "Queued",
      state: overviewDone ? "done" : transcriptDone ? "running" : "waiting",
    },
  ];
}
