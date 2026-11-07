import { Overview, type Overview as OverviewRecord } from "@overview/domain";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { makeOverviewState } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import sampleNotes from "./sampleNotes.json" with { type: "json" };

export const WATCHED_URL = "https://www.youtube.com/watch?v=storeShotVideo";

// The notes the store's screenshots show are the house account's samples, the same ones Start
// offers and the home page shows, so nothing invented is put in front of a real channel's name
// and nothing shown here is not already public (docs/features/onboarding.md, "Try a sample").
//
// sampleNotes.json is `GET /api/samples` as it stood, committed so the shots come out the same
// every time and a change to them is a diff. Refresh it with `task store:samples`.
//
// A sample arrives as a share payload, which leaves out the six fields below because a share
// never carries them. They come back as their empty values so the record is a whole Overview.
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

// The two notes the assistant shot's conversation names. They are quoted as titles rather
// than rendered, so looking them up is what keeps the quote true: refresh the samples and
// drop either one, and that shot fails rather than citing a note nobody has.
export const theSellingNote = (): OverviewRecord => titled("AI Operating System");
export const theDataNote = (): OverviewRecord => titled("software engineering is changing");

// Most of them are read, so the running total is a figure worth showing rather than the few
// minutes two notes come to (docs/features/time-saved.md).
const READ = 6;

export function storeLibrary(backendSimulator: BackendSimulator): OverviewRecord[] {
  for (const sample of SAMPLES) backendSimulator.overviews.seed(sample);
  for (const sample of SAMPLES.slice(0, READ)) {
    backendSimulator.overviews.seedState(makeOverviewState(sample.id, { read: true }));
  }
  return SAMPLES;
}
