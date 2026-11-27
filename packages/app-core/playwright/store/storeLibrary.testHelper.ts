import {
  SharedNote,
  type ChatAnswerSections,
  type ChatCitation,
  type ChatListItem,
  type Overview as OverviewRecord,
} from "@overview/domain";
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

export const STORE_QUESTION = "How do I keep my focus through a long work day?";

const cite = (overview: OverviewRecord): ChatCitation => ({ overviewId: overview.id, title: overview.source.title, item: null });

const point = (text: string, ...from: OverviewRecord[]): ChatListItem => ({ text, sources: from.map(cite) });

const section = (heading: string, bullets: ChatListItem[]): ChatAnswerSections["sections"][number] => ({
  heading,
  paragraphs: [],
  numbered: [],
  bullets,
  sources: [],
});

const answerSources = (): OverviewRecord[] => [theDataNote(), theMusicNote(), theAttentionNote(), theSellingNote(), theSleepNote()];
export const STORE_ANSWER_READ = answerSources().length;

// Each point restates its sample's own note, so the answer claims nothing the library doesn't hold.
export const storeAnswer = (): ChatAnswerReply => {
  const read = answerSources();
  const [work, music, attention, routines, sleep] = read as [
    OverviewRecord,
    OverviewRecord,
    OverviewRecord,
    OverviewRecord,
    OverviewRecord,
  ];
  const intro = "Five of your overviews agree that focus runs out, so plan for it rather than push through.";
  return {
    text: intro,
    citations: read.map(cite),
    picked: read.map((overview) => ({ overviewId: overview.id, title: overview.source.title })),
    sections: {
      intro,
      introSources: [],
      sections: [
        section("Do fewer things at once", [
          point("Kakkar ran 3 to 5 agent workstreams and was spent by mid-afternoon, so he now caps them.", work),
          point("Greene warns that split attention undermines the slow learning that mastery needs.", attention),
        ]),
        section("Take a real break", [
          point("When attention flags, Levitin takes 5 to 10 minutes of music he enjoys instead of a coffee.", music),
          point("Greene’s alternative: a minute of close attention on something ordinary, like an espresso pour.", attention),
        ]),
        section("Stop on purpose", [
          point("Kakkar leaves his laptop at work; agents and scheduled routines carry on while you’re away.", work, routines),
          point("Rest is more than a mental reset: sleep is regulated by muscles and other tissues too.", sleep),
        ]),
      ],
      takeaway: "Set a stop time, and when you flag before it, take ten minutes of music, not a coffee.",
    },
    stats: { overviews: SAMPLES.length, read: read.length, looked: SAMPLES.length },
  };
};
