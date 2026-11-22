// Both forms given, so irregular plurals and agreeing verbs are as easy as regular nouns.
export const pluralWord = (count: number, one: string, many: string): string => {
  return count === 1 ? one : many;
};

// Callers that print the number themselves take pluralWord.
export const pluralise = (count: number, one: string, many: string): string => {
  return `${count.toLocaleString("en-GB")} ${pluralWord(count, one, many)}`;
};
