const FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Takes an instant the caller has already established it has: Intl throws a RangeError on
// an invalid date, so a note saved before publishedAt existed has to be caught at the call
// site, the way OverviewThumbnail catches its own missing key.
// Carries the year, unlike the saved date beside it: how old a video is changes how its
// claims read, and that is the whole reason the date is on the page.
export function formatPublishedDate(iso: string): string {
  return FORMAT.format(new Date(iso));
}
