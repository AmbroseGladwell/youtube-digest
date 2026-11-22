// Order kept, and a tag the note already had isn't repeated.
export const retagged = (tags: readonly string[], from: ReadonlySet<string>, to: string | null): string[] => {
  const result: string[] = [];
  for (const tag of tags) {
    const next = from.has(tag) ? to : tag;
    if (next !== null && !result.includes(next)) {
      result.push(next);
    }
  }
  return result;
};
