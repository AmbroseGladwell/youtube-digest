import type { NewOverviewRun } from "../types/NewOverviewRun.js";
import { overviewReadMinutes } from "./overviewReadMinutes.js";
import { recipeCounts } from "./recipeCounts.js";

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

  if (run.article !== null) {
    const { recipe } = run.article;
    const kind = recipe === null ? "article" : "recipe";
    const label = run.article.fetched ? `Fetching the ${kind}` : run.article.oneTimeAccess ? "Reading this page" : `Reading the ${kind}`;
    return [
      {
        number: "01",
        label,
        detail:
          recipe !== null
            ? recipeCounts(recipe)
            : transcriptDone
              ? `${run.transcriptWords!.toLocaleString("en-GB")} words`
              : run.article.fetched
                ? "From the link"
                : "Reading what's on the page",
        state: transcriptDone ? "done" : "running",
      },
      {
        number: "02",
        label: "Writing the overview",
        detail: overviewDone
          ? `Overview written · ${overviewReadMinutes(run.overview!)} min read`
          : transcriptDone
            ? "Summarising, scoring and filing"
            : "Queued",
        state: overviewDone ? "done" : transcriptDone ? "running" : "waiting",
      },
    ];
  }

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
