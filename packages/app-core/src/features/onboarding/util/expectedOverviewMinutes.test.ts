import { describe, expect, it } from "vitest";
import type { Source } from "@overview/domain";
import { makeArticleOverview, makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { expectedOverviewMinutes } from "./expectedOverviewMinutes.js";

describe("expectedOverviewMinutes", () => {
  it("grows with the source, from the writer's budget at the reader's rates", () => {
    const video = (minutes: number) => ({ ...makeOverview().source, durationMs: minutes * 60_000 }) as Source;
    const short = expectedOverviewMinutes(video(10))!;
    const long = expectedOverviewMinutes(video(120))!;
    expect(long.read).toBeGreaterThan(short.read);
    expect(short.listen).toBeGreaterThanOrEqual(short.read);
  });

  it("reads an article by its words, and knows nothing of a video with no length", () => {
    expect(expectedOverviewMinutes({ ...makeArticleOverview().source, wordCount: 5000 } as Source)).not.toBeNull();
    expect(expectedOverviewMinutes({ ...makeOverview().source, durationMs: null } as Source)).toBeNull();
  });
});
