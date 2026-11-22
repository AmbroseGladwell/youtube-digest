export const READER_TABS = ["Overview", "Transcript", "Chapters"] as const;
export type ReaderTab = (typeof READER_TABS)[number];

// No transcript is kept for an article.
export const ARTICLE_TABS: readonly ReaderTab[] = ["Overview", "Chapters"];

export const UNCHAPTERED_RECIPE_VIDEO_TABS: readonly ReaderTab[] = ["Overview", "Transcript"];
