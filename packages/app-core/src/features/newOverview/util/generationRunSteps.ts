import { formatClock, recipeMinutes, SOCIAL_PLATFORM_NAME, wordCount } from "@overview/domain";
import { transcriptionCopy } from "../../podcasts/util/transcriptionCopy.js";
import type { ArticleRun, NewOverviewRun, SocialRun } from "../types/NewOverviewRun.js";
import { overviewReadMinutes } from "./overviewReadMinutes.js";
import { recipeCounts } from "./recipeCounts.js";

const FOUND_VIDEO = "Found the video";
const CAPTIONS_FOUND = "Captions found";
const LOOKING_FOR_CAPTIONS = "Looking for captions";
const LOOKED_FOR_CAPTIONS = "Looked for captions";
const MAKING_A_TRANSCRIPT = "None, so we’re making a transcript";

const SUMMARISING = "Summarising, scoring and filing";
const QUEUED = "Queued";
const WRITING = "Writing the overview";

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

  // Looking for a transcript is its own stage: docs/features/podcast-screens.md, "Making one".
  if (run.podcast !== null) {
    const wordsFound = run.podcast.words !== null;
    const { transcription, durationSeconds } = run.podcast;
    const finding: GenerationStep = {
      number: "01",
      label: "Finding the episode",
      detail: durationSeconds === null ? "Found" : recipeMinutes(Math.round(durationSeconds / 60)),
      state: "done",
    };
    // Transcribing is its own step only when needed, its estimate counting down in whole minutes.
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
        label: WRITING,
        detail: writingDetail(run, wordsFound),
        state: writingState(overviewDone, wordsFound),
      },
    ];
  }

  if (run.social !== null) {
    return socialSteps(run, run.social, { transcriptDone, overviewDone, now });
  }

  // Designs 130d, 130d-2: the words came with the read, so finding them is quick but still said.
  if (run.tiktok !== null) {
    const { durationSeconds, transcription } = run.tiktok;
    const found: GenerationStep = {
      number: "01",
      label: FOUND_VIDEO,
      detail: durationSeconds === null ? "TikTok" : `TikTok · ${formatClock(durationSeconds)}`,
      state: "done",
    };
    const words = transcriptDone ? `${run.transcriptWords!.toLocaleString("en-GB")} words` : null;
    // With no captions, transcribing is its own step, as an episode's is.
    const finding: GenerationStep[] =
      transcription === null
        ? [
            {
              number: "02",
              label: transcriptDone ? CAPTIONS_FOUND : LOOKING_FOR_CAPTIONS,
              detail: words ?? "TikTok’s own captions",
              state: transcriptDone ? "done" : "running",
            },
          ]
        : [
            { number: "02", label: LOOKED_FOR_CAPTIONS, detail: MAKING_A_TRANSCRIPT, state: "done" },
            {
              number: "03",
              label: transcriptDone ? "Transcribing the TikTok" : "Transcribing the TikTok…",
              detail:
                words === null
                  ? transcriptionCopy.progress(
                      transcription.state,
                      durationSeconds,
                      transcription.state === "transcribing" ? now - transcription.since : 0,
                    )
                  : `Transcribed · ${words}`,
              state: transcriptDone ? "done" : "running",
            },
          ];
    return [
      found,
      ...finding,
      {
        number: transcription === null ? "03" : "04",
        label: WRITING,
        detail: writingDetail(run, transcriptDone),
        state: writingState(overviewDone, transcriptDone),
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
        label: WRITING,
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

interface SocialStepState {
  transcriptDone: boolean;
  overviewDone: boolean;
  now: number;
}

// As a TikTok's (130d); a photo or text post's description is its words, read with the post.
const socialSteps = (run: NewOverviewRun, { post, transcription }: SocialRun, { transcriptDone, overviewDone, now }: SocialStepState) => {
  const platform = SOCIAL_PLATFORM_NAME[post.platform];
  if (post.media !== "video") {
    return [
      { number: "01", label: "Found the post", detail: `${platform} · ${post.media} post`, state: "done" },
      {
        number: "02",
        label: "Read the description",
        detail: `${wordCount(post.description).toLocaleString("en-GB")} words`,
        state: "done",
      },
      { number: "03", label: WRITING, detail: writingDetail(run, true), state: writingState(overviewDone, true) },
    ] satisfies GenerationStep[];
  }
  const found: GenerationStep = {
    number: "01",
    label: FOUND_VIDEO,
    detail: post.durationSeconds === null ? platform : `${platform} · ${formatClock(post.durationSeconds)}`,
    state: "done",
  };
  const words = transcriptDone ? `${run.transcriptWords!.toLocaleString("en-GB")} words` : null;
  const finding: GenerationStep[] =
    transcription === null
      ? [
          {
            number: "02",
            label: transcriptDone ? CAPTIONS_FOUND : LOOKING_FOR_CAPTIONS,
            detail: words ?? `${platform}’s captions`,
            state: transcriptDone ? "done" : "running",
          },
        ]
      : [
          { number: "02", label: LOOKED_FOR_CAPTIONS, detail: MAKING_A_TRANSCRIPT, state: "done" },
          {
            number: "03",
            label: transcriptDone ? "Transcribing the video" : "Transcribing the video…",
            detail:
              words === null
                ? transcriptionCopy.progress(
                    transcription.state,
                    post.durationSeconds,
                    transcription.state === "transcribing" ? now - transcription.since : 0,
                  )
                : `Transcribed · ${words}`,
            state: transcriptDone ? "done" : "running",
          },
        ];
  return [
    found,
    ...finding,
    {
      number: transcription === null ? "03" : "04",
      label: WRITING,
      detail: writingDetail(run, transcriptDone),
      state: writingState(overviewDone, transcriptDone),
    },
  ];
};
