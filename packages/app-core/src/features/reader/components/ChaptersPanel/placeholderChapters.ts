// Chapters are not generated at all — titling each stretch of audio would be new work in
// packages/generation, not a UI change (docs/features/overview-redesign.md, "What was not
// built"). These rows build the tab's design and are replaced once chapters exist.
export interface PlaceholderChapter {
  range: string;
  title: string;
  summary: string;
}

export const PLACEHOLDER_CHAPTERS: PlaceholderChapter[] = [
  {
    range: "0:00 – 1:04",
    title: "Placeholder chapter title",
    summary: "A generated chapter summary will sit here: two lines on what this stretch of the video covers.",
  },
  {
    range: "1:04 – 1:48",
    title: "Placeholder chapter title",
    summary: "Chapter titles are set in the heading face, the range above them in the uppercase kicker.",
  },
  {
    range: "1:48 – 3:09",
    title: "Placeholder chapter title",
    summary: "Tapping a chapter is what will move the read-along to the start of that stretch.",
  },
  {
    range: "3:09 – 4:30",
    title: "Placeholder chapter title",
    summary: "Rows are separated by hairlines, in the same rhythm as the transcript.",
  },
  {
    range: "4:30 – 5:12",
    title: "Placeholder chapter title",
    summary: "The final chapter ends where the video ends.",
  },
];
