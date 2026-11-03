export const READER_TABS = ["Overview", "Transcript", "Chapters"] as const;
export type ReaderTab = (typeof READER_TABS)[number];

// No transcript is kept for an article, and one chapter is no choice at all (design 77p).
export const ARTICLE_TABS: readonly ReaderTab[] = ["Overview", "Chapters"];
