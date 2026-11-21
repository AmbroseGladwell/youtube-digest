import { describe, expect, it } from "vitest";
import {
  episodeFoundLine,
  episodeTranscribedLine,
  overviewWrittenLine,
  pageFetchedLine,
  recipeFetchedLine,
  recipeReadyLine,
  transcriptFetchedLine,
  WAIT_COPY,
  waitScript,
  waitStage,
  waitStageIds,
} from "./waitStages.js";

describe("done lines", () => {
  it("put the caller's numbers after the label", () => {
    expect(transcriptFetchedLine(857)).toBe("Transcript fetched · 857 words");
    expect(pageFetchedLine(4100)).toBe("Page fetched · 4,100 words");
    expect(overviewWrittenLine(2)).toBe("Overview written · 2 min read");
    expect(recipeFetchedLine(14, 9)).toBe("Recipe fetched · 14 ingredients, 9 steps");
    expect(recipeReadyLine()).toBe("Recipe ready · cooking mode");
    expect(episodeFoundLine(72)).toBe("Episode found · 1 hr 12 min");
    expect(episodeTranscribedLine(72)).toBe("Episode transcribed · 1 hr 12 min");
  });

  it("say only the label when a number isn't known, never a guess", () => {
    expect(transcriptFetchedLine(null)).toBe("Transcript fetched");
    expect(pageFetchedLine(0)).toBe("Page fetched");
    expect(overviewWrittenLine(undefined)).toBe("Overview written");
    expect(episodeFoundLine(null)).toBe("Episode found");
    expect(recipeFetchedLine(null, null)).toBe("Recipe fetched");
  });

  it("keep whichever recipe count is known and say one in the singular", () => {
    expect(recipeFetchedLine(14, null)).toBe("Recipe fetched · 14 ingredients");
    expect(recipeFetchedLine(null, 1)).toBe("Recipe fetched · 1 step");
    expect(transcriptFetchedLine(1)).toBe("Transcript fetched · 1 word");
  });
});

describe("waitStageIds", () => {
  it("is each kind's real stages, in order", () => {
    expect(waitStageIds("video")).toEqual(["fetchTranscript", "write"]);
    expect(waitStageIds("article")).toEqual(["fetchPage", "write"]);
    expect(waitStageIds("recipe")).toEqual(["fetchRecipe", "prepareRecipe"]);
    expect(waitStageIds("podcast")).toEqual(["findEpisode", "fetchTranscript", "write"]);
  });

  it("swaps fetching for transcribing on an episode with no transcript", () => {
    expect(waitStageIds("podcast", { transcribing: true })).toEqual(["findEpisode", "transcribe", "write"]);
  });
});

describe("waitStage", () => {
  it("names a stage until it's done, then gives its done line", () => {
    expect(waitStage("fetchTranscript", "running")).toEqual({
      name: "Fetching transcript",
      doneLine: null,
      state: "running",
      detail: null,
    });
    expect(waitStage("fetchTranscript", "done", { transcriptWords: 857 }).doneLine).toBe("Transcript fetched · 857 words");
    expect(waitStage("write", "done", { readMinutes: 2 }).doneLine).toBe("Overview written · 2 min read");
    expect(waitStage("prepareRecipe", "waiting").name).toBe("Preparing the recipe");
  });

  it("carries a real sub-line, such as the transcriber's estimate", () => {
    expect(waitStage("transcribe", "running", {}, "About 2 min left").detail).toBe("About 2 min left");
  });
});

describe("waitScript", () => {
  it("ends the video's script with steps for the reader's focus, or for them", () => {
    expect(waitScript("video", { focus: "your marathon training" }).at(-1)).toBe("Writing steps for your marathon training");
    expect(waitScript("video").at(-1)).toBe("Writing steps for you");
  });

  it("ends an article's on what it links to and a recipe's on its timers", () => {
    expect(waitScript("article").at(-1)).toBe("Noting what it links to");
    expect(waitScript("recipe")).toEqual([
      "Reading the page",
      "Picking out the ingredients",
      "Laying out the method",
      "Marking the amounts that scale",
      "Setting the timers",
    ]);
  });

  it("is shorter for an episode that had to be transcribed first", () => {
    expect(waitScript("podcast", { transcribing: true })).toEqual([
      "Reading the transcript",
      "Checking the claims",
      "Writing your verdict",
    ]);
  });
});

describe("WAIT_COPY", () => {
  it("speaks of a recipe as a recipe", () => {
    expect(WAIT_COPY.recipe).toEqual({
      heading: "Preparing your recipe.",
      readyHeading: "Your recipe is ready.",
      cardLabel: "Your recipe",
      openLabel: "Open your recipe",
      keepTabLine: "You can switch tabs but keep this tab open: closing or reloading it stops preparing the recipe.",
    });
    expect(WAIT_COPY.video.heading).toBe("Pulling out the good bits…");
    expect(WAIT_COPY.video.openLabel).toBe("Open your overview");
  });
});
