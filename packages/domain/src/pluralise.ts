// Both forms are given rather than an "s" being added, so an irregular plural and a verb
// that has to agree ("video is", "videos are") are as easy to write as a regular noun.
export function pluralWord(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// The count and its word together. Callers that print the number themselves — the Saved
// you chip counts its own up in its own element — take pluralWord instead.
export function pluralise(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-GB")} ${pluralWord(count, one, many)}`;
}
