// The format of the saved date beside it on the same screen (ReaderMasthead's savedOn).
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const views = (count: number) => (count === 1 ? "1 view" : `${count} views`);

export const shareStatusLine = (sharedAt: string, viewCount: number): string => {
  return `Shared ${DAY.format(new Date(sharedAt))} · ${views(viewCount)}`;
};
