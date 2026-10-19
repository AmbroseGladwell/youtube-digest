import { randomUUID } from "node:crypto";
import { OverviewId, type Overview } from "@overview/domain";
import { assembleOverview } from "@overview/generation";
import { comparisonInput } from "./runOne.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";

export const makeOverview = (overrides: Parameters<typeof makeGeneratedOutput>[0] = {}): Overview =>
  assembleOverview(comparisonInput(makeFetchedTranscript()), makeGeneratedOutput(overrides), {
    id: OverviewId.parse(randomUUID()),
    savedAt: "2026-10-12T12:00:00.000Z",
  });
