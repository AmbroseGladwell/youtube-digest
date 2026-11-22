const FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Intl throws on an invalid date, so the caller checks a note saved before publishedAt existed.
export const formatPublishedDate = (iso: string): string => {
  return FORMAT.format(new Date(iso));
};
