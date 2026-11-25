import { SharedNote, type ChatAnswerSections, type ChatCitation, type Overview as OverviewRecord } from "@overview/domain";
import type { BackendSimulator, ChatAnswerReply } from "../network/BackendSimulator.testHelper.js";
import { makeOverviewState } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { savedFromShare } from "../../src/features/sharedPage/util/savedFromShare.js";
import sampleNotes from "./sampleNotes.json" with { type: "json" };

// Saved the way Start saves a sample.
export const SAMPLES: OverviewRecord[] = sampleNotes.map((note) => savedFromShare(SharedNote.parse(note), true));

const titled = (fragment: string): OverviewRecord => {
  const found = SAMPLES.find((sample) => sample.source.title.includes(fragment));
  if (found === undefined) {
    throw new Error(
      `no sample's title holds "${fragment}": the house account's samples have changed, so run task store:samples and pick again`,
    );
  }
  return found;
};

// Looked up, not written out, so a refresh that drops any of them fails the shot.
export const theSellingNote = (): OverviewRecord => titled("AI Operating System");
export const theDataNote = (): OverviewRecord => titled("software engineering is changing");
export const theBigPictureNote = (): OverviewRecord => titled("Randomness is a lie");
export const theBigPictureVideoUrl = (): string => {
  const { source } = theBigPictureNote();
  if (source.kind !== "youtube") {
    throw new Error(`"${source.title}" is no longer a video, so it can't sit beside one in the panel: pick another sample`);
  }
  return source.url;
};
export const theRecipe = (): OverviewRecord => titled("pesto lasagne");
const theSleepNote = (): OverviewRecord => titled("Sleep Evolved Before Brains");
const theMusicNote = (): OverviewRecord => titled("Music Can Be Medicine");
const theAttentionNote = (): OverviewRecord => titled("Access the Sublime");

// One of each kind leads, and none of them carries a flag against a named show.
export const oneOfEachKind = (): OverviewRecord[] => [theBigPictureNote(), theAttentionNote(), theSleepNote(), theRecipe()];

// Most are read, so the running total is worth showing.
const READ = 6;

const NEWEST = Date.parse("2026-11-24T18:00:00.000Z");
const HOUR = 60 * 60 * 1000;

export const storeLibrary = (backendSimulator: BackendSimulator, newestFirst: OverviewRecord[] = []): OverviewRecord[] => {
  const ordered = SAMPLES.map((sample) => {
    const place = newestFirst.findIndex(({ id }) => id === sample.id);
    return place === -1 ? sample : { ...sample, savedAt: new Date(NEWEST - place * HOUR).toISOString() };
  });
  for (const sample of ordered) {
    backendSimulator.overviews.seed(sample);
  }
  // Unread comes first, so the ones placed to lead stay unread.
  const readable = ordered.filter(({ id }) => !newestFirst.some((lead) => lead.id === id));
  for (const sample of readable.slice(0, READ)) {
    backendSimulator.overviews.seedState(makeOverviewState(sample.id, { read: true }));
  }
  return ordered;
};

export const STORE_QUESTION = "What have I saved about the brain and attention?";

const cite = (overview: OverviewRecord): ChatCitation => ({ overviewId: overview.id, title: overview.source.title, item: null });

const section = (heading: string, paragraph: string, from: OverviewRecord): ChatAnswerSections["sections"][number] => ({
  heading,
  paragraphs: [paragraph],
  numbered: [],
  bullets: [],
  sources: [{ citation: cite(from), relation: "Supports" }],
});

// Each line restates its sample's own note, so the answer claims nothing the library doesn't hold.
export const storeAnswer = (): ChatAnswerReply => {
  const sleep = theSleepNote();
  const music = theMusicNote();
  const attention = theAttentionNote();
  const read = [sleep, music, attention];
  return {
    text: "Three of your overviews come at it from different sides.",
    citations: read.map(cite),
    picked: read.map((overview) => ({ overviewId: overview.id, title: overview.source.title })),
    sections: {
      intro: "Three of your overviews come at it from different sides.",
      introSources: [],
      sections: [
        section("Sleep came before brains", "Hydras have no brain, yet they meet the behavioural tests for sleep.", sleep),
        section("Music as a memory cue", "Familiar music can bring back memories for some people with Alzheimer’s.", music),
        section("Attention you can train", "Greene argues that slow, deliberate attention makes ordinary things vivid.", attention),
      ],
      takeaway: "One to try this week: Levitin’s five to ten minutes of music when your attention flags.",
    },
    stats: { overviews: SAMPLES.length, read: read.length, looked: SAMPLES.length },
  };
};
