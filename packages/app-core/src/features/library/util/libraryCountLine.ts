// The list's subtitle.
export const libraryCountLine = ({ total, unread }: { total: number; unread: number }): string => {
  return `${total} ${total === 1 ? "overview" : "overviews"} · ${unread} unread`;
};
