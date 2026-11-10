import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { quotationCounts } from "./quotationCounts.js";

const quoted = { text: "the words", range: { startMs: 0, endMs: 1000 } };

describe("quotationCounts", () => {
  it("counts the lines that quote the source", () => {
    const overview = makeOverview();
    const counted = quotationCounts({
      ...overview,
      keyPoints: [
        { ...overview.keyPoints[0]!, evidence: quoted },
        { ...overview.keyPoints[1]!, evidence: quoted },
        ...overview.keyPoints.slice(2),
      ],
    });
    expect(counted).toEqual({ quotations: 2 });
  });

  it("says none for a note without quotations", () => {
    expect(quotationCounts(makeOverview())).toEqual({ quotations: 0 });
  });
});
