import { describe, expect, it } from "vitest";
import type { ReadingPosition } from "../types/ReadingPosition.js";
import {
  READING_POSITIONS_KEPT,
  forgetReadingPositionIn,
  readingPositionFor,
  rememberReadingPosition,
} from "./readingPositions.js";

describe("readingPositions", () => {
  it("answers null for a video never read", () => {
    expect(readingPositionFor([], "video1")).toBeNull();
  });

  it("remembers the most recent position for a video, replacing the last one", () => {
    const positions = rememberReadingPosition(
      rememberReadingPosition([], "video1", 5000),
      "video1",
      9000,
    );

    expect(positions).toEqual([{ videoId: "video1", startMs: 9000 }]);
    expect(readingPositionFor(positions, "video1")).toBe(9000);
  });

  it("keeps the video read most recently first", () => {
    const positions = rememberReadingPosition(
      rememberReadingPosition([], "video1", 5000),
      "video2",
      1000,
    );

    expect(positions.map((position) => position.videoId)).toEqual(["video2", "video1"]);
  });

  it("drops the video read longest ago once the cap is reached", () => {
    let positions: ReadingPosition[] = [];
    for (let index = 0; index <= READING_POSITIONS_KEPT; index++) {
      positions = rememberReadingPosition(positions, `video${index}`, 1000);
    }

    expect(positions).toHaveLength(READING_POSITIONS_KEPT);
    expect(readingPositionFor(positions, "video0")).toBeNull();
    expect(readingPositionFor(positions, `video${READING_POSITIONS_KEPT}`)).toBe(1000);
  });

  it("forgets one video and leaves the others where they were", () => {
    const positions = forgetReadingPositionIn(
      rememberReadingPosition(rememberReadingPosition([], "video1", 5000), "video2", 1000),
      "video2",
    );

    expect(positions).toEqual([{ videoId: "video1", startMs: 5000 }]);
  });
});
