import { domainOf, SOCIAL_PLATFORM_NAME, socialTitle, tiktokTitle } from "@overview/domain";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { generationRunSteps } from "../../util/generationRunSteps.js";

export type JustNowStage = "fetch" | "write" | "done" | "saved" | "keptForReset" | "failed";

export interface JustNowRow {
  stage: JustNowStage;
  kicker: string;
  title: string;
  label: string;
  detail: string;
  // The step running now, or one past the last once it's done.
  step: number;
  steps: number;
  // What the last finished step said, beside "Waiting for you" (design 356f-2).
  finished: string;
}

const kickerOf = (run: NewOverviewRun): string => {
  if (run.tiktok !== null) {
    return `@${run.tiktok.handle} · TikTok`;
  }
  if (run.social !== null) {
    return SOCIAL_PLATFORM_NAME[run.social.post.platform];
  }
  if (run.podcast !== null) {
    return run.podcast.show;
  }
  if (run.article !== null) {
    return run.article.site;
  }
  return run.video?.channel ?? domainOf(run.url);
};

const titleOf = (run: NewOverviewRun): string => {
  if (run.tiktok !== null) {
    return tiktokTitle(run.tiktok.caption, run.tiktok.handle);
  }
  if (run.social !== null) {
    return socialTitle(run.social.post);
  }
  return run.podcast?.title ?? run.article?.title ?? run.video?.title ?? run.url;
};

const stageOf = (run: NewOverviewRun, writing: boolean): JustNowStage => {
  if (run.keptUntilReset === true) {
    return "keptForReset";
  }
  if (run.error !== null) {
    return "failed";
  }
  if (run.saved != null) {
    return "saved";
  }
  if (run.overview !== null) {
    return "done";
  }
  return writing ? "write" : "fetch";
};

// Design 358b: one line for where a link has got to, from the same steps the progress view had.
export const justNowRowOf = (run: NewOverviewRun, now: number = Date.now()): JustNowRow => {
  const steps = generationRunSteps(run, now);
  const runningIndex = steps.findIndex((step) => step.state === "running");
  const doneCount = steps.filter((step) => step.state === "done").length;
  const current = steps[runningIndex] ?? steps.at(-1)!;
  const writing = runningIndex === steps.length - 1;
  return {
    stage: stageOf(run, writing),
    kicker: kickerOf(run),
    title: titleOf(run),
    label: current.label,
    detail: current.detail,
    step: runningIndex === -1 ? doneCount + 1 : runningIndex + 1,
    steps: steps.length,
    finished: steps.filter((step) => step.state === "done").at(-1)?.detail ?? "",
  };
};
