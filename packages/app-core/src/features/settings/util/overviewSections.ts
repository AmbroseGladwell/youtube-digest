import { HOW_TO_APPLY_SECTION, WATCH_ANYWAY_SECTION, type SectionsEnabled } from "@overview/domain";

export interface OverviewSection {
  section: keyof SectionsEnabled;
  label: string;
  hint: string;
}

export const OVERVIEW_SECTIONS: OverviewSection[] = [
  { section: "verdict", label: "Verdict", hint: "How new the idea is, and any claims worth doubting." },
  { section: "selling", label: "What it sells", hint: "Whether the video is selling something, and if that bends what it says." },
  { section: "howToApply", label: HOW_TO_APPLY_SECTION, hint: "Steps for putting the video to use." },
  { section: "watchAnyway", label: WATCH_ANYWAY_SECTION, hint: "Whether any of it is worth watching for yourself." },
];
