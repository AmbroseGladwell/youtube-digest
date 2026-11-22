import { Overview, type Overview as OverviewRecord } from "@overview/domain";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { makeOverviewState } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import sampleNotes from "./sampleNotes.json" with { type: "json" };

export const WATCHED_URL = "https://www.youtube.com/watch?v=storeShotVideo";

// A share never carries the six fields below, so they come back empty to make a whole Overview.
const whole = (note: unknown): OverviewRecord =>
  Overview.parse({
    captureReason: null,
    fromPlaylist: null,
    madeOn: null,
    topicIds: [],
    article: null,
    recipe: null,
    ...(note as Record<string, unknown>),
  });

export const SAMPLES: OverviewRecord[] = sampleNotes.map(whole);

const titled = (fragment: string): OverviewRecord => {
  const found = SAMPLES.find((sample) => sample.source.title.includes(fragment));
  if (found === undefined) {
    throw new Error(
      `no sample's title holds "${fragment}": the house account's samples have changed, so run task store:samples and pick again`,
    );
  }
  return found;
};

// Looked up, not written out, so a refresh that drops either one fails the shot.
export const theSellingNote = (): OverviewRecord => titled("AI Operating System");
export const theDataNote = (): OverviewRecord => titled("software engineering is changing");

// Most are read, so the running total is worth showing.
const READ = 6;

export const storeLibrary = (backendSimulator: BackendSimulator): OverviewRecord[] => {
  for (const sample of SAMPLES) {
    backendSimulator.overviews.seed(sample);
  }
  for (const sample of SAMPLES.slice(0, READ)) {
    backendSimulator.overviews.seedState(makeOverviewState(sample.id, { read: true }));
  }
  return SAMPLES;
};
