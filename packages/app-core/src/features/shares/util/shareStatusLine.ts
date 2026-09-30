// The same day-and-month the reader's saved date is printed in, rather than a second
// format that would disagree with it on the same screen (ReaderMasthead's savedOn).
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const views = (count: number) => (count === 1 ? "1 view" : `${count} views`);

// "Shared 30 Sept · 12 views". The count comes from the server, which counted; nothing
// here estimates it (docs/prototype/constraints.md).
export function shareStatusLine(sharedAt: string, viewCount: number): string {
  return `Shared ${DAY.format(new Date(sharedAt))} · ${views(viewCount)}`;
}
