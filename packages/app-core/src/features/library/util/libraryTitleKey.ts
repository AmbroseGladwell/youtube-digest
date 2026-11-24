// A leading "The" is skipped, so the order and the letter groups agree: design 399p.
export const libraryTitleKey = (title: string): string => title.trim().replace(/^the\s+/i, "");
