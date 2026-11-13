import { recipeMinutes } from "@overview/domain";
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

  // Design 106g: finding the episode is done before Create, and looking for a transcript is a
  // stage of its own, since it's the one that fails for half of episodes. It never says where
  // the words came from.
  if (run.podcast !== null) {
    const wordsFound = run.podcast.words !== null;
    return [
      {
        number: "01",
        label: "Finding the episode",
        detail: run.podcast.durationSeconds === null ? "Found" : recipeMinutes(Math.round(run.podcast.durationSeconds / 60)),
        state: "done",
      },
      {
        number: "02",
        label: "Looking for a transcript",
        detail: wordsFound ? `Found · ${run.podcast.words!.toLocaleString("en-GB")} words` : "This can take a few seconds",
        state: wordsFound ? "done" : "running",
      },
      {
        number: "03",
        label: "Writing the overview",
        detail: overviewDone
          ? `Overview written · ${overviewReadMinutes(run.overview!)} min read`
          : wordsFound
            ? "Summarising, scoring and filing"
            : "Queued",
        state: overviewDone ? "done" : wordsFound ? "running" : "waiting",
      },
    ];
  }

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
        ? run.overview!.recipe != null
          ? `Recipe · ${recipeCounts({ ingredients: run.overview!.recipe.ingredients.length, steps: run.overview!.recipe.stepCount })}`
          : `Overview written · ${overviewReadMinutes(run.overview!)} min read`
        : transcriptDone
          ? "Summarising, scoring and filing"
          : "Queued",
      state: overviewDone ? "done" : transcriptDone ? "running" : "waiting",
    },
  ];
}
