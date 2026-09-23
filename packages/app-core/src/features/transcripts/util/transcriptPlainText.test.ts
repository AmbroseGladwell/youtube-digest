import type { VideoSource } from "@overview/domain";
import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeTranscriptBlock } from "../types/TranscriptBlockFactory.testHelper.js";
import { transcriptPlainText } from "./transcriptPlainText.js";

const VIDEO: VideoSource = {
  ...makeOverview().video,
  title: "The Quiet Return of Nuclear Baseload",
  channel: "Practical Engineering",
  url: "https://www.youtube.com/watch?v=example",
};

describe("transcriptPlainText", () => {
  it("names the video before the words, so a pasted transcript says where it came from", () => {
    const text = transcriptPlainText(VIDEO, [
      makeTranscriptBlock({ text: "The first paragraph." }),
    ]);

    expect(text).toBe(
      "The Quiet Return of Nuclear Baseload\n" +
        "Practical Engineering\n" +
        "https://www.youtube.com/watch?v=example\n" +
        "\n" +
        "0:00\tThe first paragraph.\n",
    );
  });

  it("prints each block against the time its first words were said", () => {
    const text = transcriptPlainText(VIDEO, [
      makeTranscriptBlock({ text: "First.", startMs: 0 }),
      makeTranscriptBlock({ text: "Second.", startMs: 65_000 }),
      makeTranscriptBlock({ text: "Third.", startMs: 3_661_000 }),
    ]);

    expect(text.split("\n\n").slice(1)).toEqual([
      "0:00\tFirst.",
      "1:05\tSecond.",
      "1:01:01\tThird.\n",
    ]);
  });

  it("keeps the em dash a change of speaker is printed with", () => {
    const text = transcriptPlainText(VIDEO, [
      makeTranscriptBlock({ text: "Thank you.", speakerChange: true }),
    ]);

    expect(text).toContain("0:00\t— Thank you.");
  });

  it("writes only the heading for a video whose transcript has no blocks", () => {
    expect(transcriptPlainText(VIDEO, [])).toBe(
      "The Quiet Return of Nuclear Baseload\nPractical Engineering\nhttps://www.youtube.com/watch?v=example\n\n\n",
    );
  });
});
