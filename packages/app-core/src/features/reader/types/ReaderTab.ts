export const READER_TABS = ["Overview", "Transcript", "Chapters"] as const;
export type ReaderTab = (typeof READER_TABS)[number];
