import type { VideoSource } from "@overview/types";
import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { transcriptFileName } from "./transcriptFileName.js";

const videoTitled = (title: string): VideoSource => ({ ...makeOverview().video, title });

describe("transcriptFileName", () => {
  it("slugs the video's title", () => {
    expect(transcriptFileName(videoTitled("The Quiet Return of Nuclear Baseload"))).toBe(
      "the-quiet-return-of-nuclear-baseload-transcript.txt",
    );
  });

  it("collapses punctuation and spacing into single hyphens", () => {
    expect(transcriptFileName(videoTitled("Why?  Because: it *works*!"))).toBe(
      "why-because-it-works-transcript.txt",
    );
  });

  it("leaves no hyphen hanging off either end", () => {
    expect(transcriptFileName(videoTitled("  — Nuclear —  "))).toBe("nuclear-transcript.txt");
  });

  it("cuts a very long title short without leaving a trailing hyphen", () => {
    const name = transcriptFileName(videoTitled("a ".repeat(80)));

    expect(name).toBe(`${"a-".repeat(30).slice(0, -1)}-transcript.txt`);
    expect(name).not.toContain("--");
  });

  it("falls back to a plain name for a title with nothing sluggable in it", () => {
    expect(transcriptFileName(videoTitled("♦♦♦"))).toBe("transcript.txt");
  });
});
