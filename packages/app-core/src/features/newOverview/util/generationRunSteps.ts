import { recipeMinutes } from "@overview/domain";
import { transcriptionCopy } from "../../podcasts/util/transcriptionCopy.js";
import type { ArticleRun, NewOverviewRun } from "../types/NewOverviewRun.js";
import { overviewReadMinutes } from "./overviewReadMinutes.js";
import { recipeCounts } from "./recipeCounts.js";

const SUMMARISING = "Summarising, scoring and filing";
const QUEUED = "Queued";

export type GenerationStepState = "waiting" | "running" | "done";

export interface GenerationStep {
  number: string;
  label: string;
  detail: string;
  state: GenerationStepState;
}

const writingState = (overviewDone: boolean, inputDone: boolean): GenerationStepState => {
  if (overviewDone) {
    return "done";
  }
  return inputDone ? "running" : "waiting";
};

const writingDetail = (run: NewOverviewRun, inputDone: boolean): string => {
  if (run.overview !== null) {
    return `Overview written · ${overviewReadMinutes(run.overview)} min read`;
  }
  return inputDone ? SUMMARISING : QUEUED;
};

const creatingDetail = (run: NewOverviewRun): string => {
  if (run.overview === null) {
    return run.transcriptWords !== null ? SUMMARISING : QUEUED;
  }
  if (run.overview.recipe != null) {
    return `Recipe · ${recipeCounts({ ingredients: run.overview.recipe.ingredients.length, steps: run.overview.recipe.stepCount })}`;
  }
  return `Overview written · ${overviewReadMinutes(run.overview)} min read`;
};

const readingLabel = (article: ArticleRun, kind: string): string => {
  if (article.fetched) {
    return `Fetching the ${kind}`;
  }
  return article.oneTimeAccess ? "Reading this page" : `Reading the ${kind}`;
};

const readingDetail = (article: ArticleRun, transcriptWords: number | null): string => {
  if (article.recipe !== null) {
    return recipeCounts(article.recipe);
  }
  if (transcriptWords !== null) {
    return `${transcriptWords.toLocaleString("en-GB")} words`;
  }
  return article.fetched ? "From the link" : "Reading what's on the page";
};

export const generationRunSteps = (run: NewOverviewRun, now: number = Date.now()): GenerationStep[] => {
  const transcriptDone = run.transcriptWords !== null;
  const overviewDone = run.overview !== null;

  // Design 106g: finding the episode is done before Create, and looking for a transcript is a
  // stage of its own, since it's the one that fails for half of episodes. It never says where
  // the words came from.
  if (run.podcast !== null) {
    const wordsFound = run.podcast.words !== null;
    const { transcription, durationSeconds } = run.podcast;
    const finding: GenerationStep = {
      number: "01",
      label: "Finding the episode",
      detail: durationSeconds === null ? "Found" : recipeMinutes(Math.round(durationSeconds / 60)),
      state: "done",
    };
    // Design 305e: transcribing is a step of its own, between looking and writing, only when it's
    // needed; its estimate counts down in whole minutes from the audio's length.
    const looking: GenerationStep[] =
      transcription === null
        ? [
            {
              number: "02",
              label: "Looking for a transcript",
              detail: wordsFound ? `Found · ${run.podcast.words!.toLocaleString("en-GB")} words` : "This can take a few seconds",
              state: wordsFound ? "done" : "running",
            },
          ]
        : [
            { number: "02", label: "Looking for a transcript", detail: "None, so we’re making one", state: "done" },
            {
              number: "03",
              label: wordsFound ? "Transcribing the episode" : "Transcribing the episode…",
              detail: wordsFound
                ? `Transcribed · ${run.podcast.words!.toLocaleString("en-GB")} words`
                : transcriptionCopy.progress(
                    transcription.state,
                    durationSeconds,
                    transcription.state === "transcribing" ? now - transcription.since : 0,
                  ),
              state: wordsFound ? "done" : "running",
            },
          ];
    return [
      finding,
      ...looking,
      {
        number: transcription === null ? "03" : "04",
        label: "Writing the overview",
        detail: writingDetail(run, wordsFound),
        state: writingState(overviewDone, wordsFound),
      },
    ];
  }

  if (run.article !== null) {
    const { recipe } = run.article;
    const kind = recipe === null ? "article" : "recipe";
    const label = readingLabel(run.article, kind);
    return [
      {
        number: "01",
        label,
        detail: readingDetail(run.article, run.transcriptWords),
        state: transcriptDone ? "done" : "running",
      },
      {
        number: "02",
        label: "Writing the overview",
        detail: writingDetail(run, transcriptDone),
        state: writingState(overviewDone, transcriptDone),
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
      detail: creatingDetail(run),
      state: writingState(overviewDone, transcriptDone),
    },
  ];
};
