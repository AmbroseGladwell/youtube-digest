export interface LibraryCountLineOptions {
  total: number;
  unread: number;
}

export const libraryCountLine = ({ total, unread }: LibraryCountLineOptions): string => {
  return `${total} ${total === 1 ? "overview" : "overviews"} · ${unread} unread`;
};
