import {
  HOW_TO_APPLY_SECTION,
  RESOURCES_SECTION,
  SOURCE_STEPS_SECTION,
  WATCH_ANYWAY_SECTION,
  type SectionsEnabled,
} from "@overview/domain";

export interface OverviewSection {
  section: keyof SectionsEnabled;
  label: string;
  hint: string;
}

export const OVERVIEW_SECTIONS: OverviewSection[] = [
  { section: "verdict", label: "Verdict", hint: "How new the idea is, and any claims worth doubting." },
  { section: "selling", label: "What it sells", hint: "Whether the video is selling something, and if that bends what it says." },
  // Design 250r: in note order, and "steps" belongs to one block, so How to apply's hint says ways.
  {
    section: "steps",
    label: SOURCE_STEPS_SECTION,
    hint: "When a video or article lays out a process, every step of it, in its order, and only what the source says.",
  },
  { section: "howToApply", label: HOW_TO_APPLY_SECTION, hint: "Ways to put it to use in your own life, written for you." },
  { section: "watchAnyway", label: WATCH_ANYWAY_SECTION, hint: "Whether any of it is worth watching for yourself." },
  // Design 203t: last, as the block is last in the note.
  {
    section: "resources",
    label: RESOURCES_SECTION,
    hint: "Links an article shares that are worth opening, each with why and where it was shared.",
  },
];
