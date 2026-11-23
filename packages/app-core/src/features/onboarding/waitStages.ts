import { recipeMinutes } from "@overview/domain";
import { audioLength } from "../podcasts/util/transcriptionCopy.js";

export type WaitKind = "video" | "article" | "recipe" | "podcast";

export type WaitStageId =
  | "findEpisode"
  | "fetchTranscript"
  | "transcribe"
  | "transcribeClip"
  | "fetchPage"
  | "fetchRecipe"
  | "write"
  | "prepareRecipe";

export type WaitStageState = "waiting" | "running" | "done";

export interface WaitStage {
  name: string;
  doneLine: string | null;
  state: WaitStageState;
  detail?: string | null;
}

export interface WaitFacts {
  transcriptWords?: number | null;
  pageWords?: number | null;
  readMinutes?: number | null;
  ingredients?: number | null;
  steps?: number | null;
  episodeMinutes?: number | null;
  clipSeconds?: number | null;
}

export interface WaitCopy {
  heading: string;
  readyHeading: string;
  cardLabel: string;
  openLabel: string;
  keepTabLine: string;
}

const known = (value: number | null | undefined): value is number => value !== null && value !== undefined && value > 0;

const withDetail = (label: string, detail: string | null): string => (detail === null ? label : `${label} · ${detail}`);

const plural = (count: number, one: string, many: string): string => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;

export const transcriptFetchedLine = (words?: number | null): string =>
  withDetail("Transcript fetched", known(words) ? plural(words, "word", "words") : null);

export const pageFetchedLine = (words?: number | null): string =>
  withDetail("Page fetched", known(words) ? plural(words, "word", "words") : null);

export const overviewWrittenLine = (readMinutes?: number | null): string =>
  withDetail("Overview written", known(readMinutes) ? `${readMinutes} min read` : null);

export const recipeFetchedLine = (ingredients?: number | null, steps?: number | null): string => {
  const parts = [
    known(ingredients) ? plural(ingredients, "ingredient", "ingredients") : null,
    known(steps) ? plural(steps, "step", "steps") : null,
  ].filter((part): part is string => part !== null);
  return withDetail("Recipe fetched", parts.length === 0 ? null : parts.join(", "));
};

export const recipeReadyLine = (): string => "Recipe ready · cooking mode";

export const episodeFoundLine = (minutes?: number | null): string =>
  withDetail("Episode found", known(minutes) ? recipeMinutes(minutes) : null);

export const episodeTranscribedLine = (minutes?: number | null): string =>
  withDetail("Episode transcribed", known(minutes) ? recipeMinutes(minutes) : null);

export const clipTranscribedLine = (seconds?: number | null): string =>
  withDetail("TikTok transcribed", known(seconds) ? audioLength(seconds) : null);

const STAGES: Record<WaitStageId, { name: string; doneLine: (facts: WaitFacts) => string }> = {
  findEpisode: { name: "Finding the episode", doneLine: (facts) => episodeFoundLine(facts.episodeMinutes) },
  fetchTranscript: { name: "Fetching transcript", doneLine: (facts) => transcriptFetchedLine(facts.transcriptWords) },
  transcribe: { name: "Transcribing the episode", doneLine: (facts) => episodeTranscribedLine(facts.episodeMinutes) },
  transcribeClip: { name: "Transcribing the TikTok", doneLine: (facts) => clipTranscribedLine(facts.clipSeconds) },
  fetchPage: { name: "Fetching the page", doneLine: (facts) => pageFetchedLine(facts.pageWords) },
  fetchRecipe: { name: "Fetching the recipe", doneLine: (facts) => recipeFetchedLine(facts.ingredients, facts.steps) },
  write: { name: "Creating overview", doneLine: (facts) => overviewWrittenLine(facts.readMinutes) },
  prepareRecipe: { name: "Preparing the recipe", doneLine: () => recipeReadyLine() },
};

export const waitStageIds = (kind: WaitKind, { transcribing = false }: { transcribing?: boolean } = {}): readonly WaitStageId[] => {
  switch (kind) {
    case "video":
      // Only a TikTok with no captions is transcribed among videos.
      return [transcribing ? "transcribeClip" : "fetchTranscript", "write"];
    case "article":
      return ["fetchPage", "write"];
    case "recipe":
      return ["fetchRecipe", "prepareRecipe"];
    case "podcast":
      return ["findEpisode", transcribing ? "transcribe" : "fetchTranscript", "write"];
  }
};

export const waitStage = (id: WaitStageId, state: WaitStageState, facts: WaitFacts = {}, detail: string | null = null): WaitStage => {
  const stage = STAGES[id];
  return { name: stage.name, doneLine: state === "done" ? stage.doneLine(facts) : null, state, detail };
};

const stepsFor = (focus: string | null): string => `Writing steps for ${focus ?? "you"}`;

export interface WaitScriptOptions {
  focus?: string | null;
  transcribing?: boolean;
}

export const waitScript = (kind: WaitKind, { focus = null, transcribing = false }: WaitScriptOptions = {}): readonly string[] => {
  switch (kind) {
    case "video":
      return ["Reading the transcript", "Finding what's new in it", "Checking the claims", "Writing your verdict", stepsFor(focus)];
    case "article":
      return ["Reading the article", "Finding what's new in it", "Checking the claims", "Writing your verdict", "Noting what it links to"];
    case "recipe":
      return [
        "Reading the page",
        "Picking out the ingredients",
        "Laying out the method",
        "Marking the amounts that scale",
        "Setting the timers",
      ];
    case "podcast":
      return transcribing
        ? ["Reading the transcript", "Checking the claims", "Writing your verdict"]
        : ["Reading the transcript", "Finding what's new in it", "Checking the claims", "Writing your verdict", stepsFor(focus)];
  }
};

const OVERVIEW_KEEP_TAB = "You can switch tabs but keep this tab open: closing or reloading it stops generating the overview.";

export const WAIT_COPY: Record<WaitKind, WaitCopy> = {
  video: {
    heading: "Pulling out the good bits…",
    readyHeading: "Your overview is ready.",
    cardLabel: "Your overview",
    openLabel: "Open your overview",
    keepTabLine: OVERVIEW_KEEP_TAB,
  },
  article: {
    heading: "Writing your overview.",
    readyHeading: "Your overview is ready.",
    cardLabel: "Your overview",
    openLabel: "Open your overview",
    keepTabLine: OVERVIEW_KEEP_TAB,
  },
  podcast: {
    heading: "Writing your overview.",
    readyHeading: "Your overview is ready.",
    cardLabel: "Your overview",
    openLabel: "Open your overview",
    keepTabLine: OVERVIEW_KEEP_TAB,
  },
  recipe: {
    heading: "Preparing your recipe.",
    readyHeading: "Your recipe is ready.",
    cardLabel: "Your recipe",
    openLabel: "Open your recipe",
    keepTabLine: "You can switch tabs but keep this tab open: closing or reloading it stops preparing the recipe.",
  },
};
