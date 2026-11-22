export const READER_TABS = ["Overview", "Transcript", "Chapters"] as const;
export type ReaderTab = (typeof READER_TABS)[number];

// No transcript is kept for an article.
export const ARTICLE_TABS: readonly ReaderTab[] = ["Overview", "Chapters"];

export const UNCHAPTERED_VIDEO_TABS: readonly ReaderTab[] = ["Overview", "Transcript"];

// A short clip's note is made with no chapters; a note from before chapters keeps the tab to say so.
export const timedSourceTabs = (chapterCount: number | null, recipe: boolean): readonly ReaderTab[] =>
  chapterCount === 0 || (recipe && chapterCount === null) ? UNCHAPTERED_VIDEO_TABS : READER_TABS;
