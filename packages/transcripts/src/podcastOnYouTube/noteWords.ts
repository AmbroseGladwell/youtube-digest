const SHARED_BY_SHARE_OF_EPISODES = 0.3;
const FEWEST_EPISODES_TO_JUDGE_BY = 4;
const MOST_KEYWORDS = 300;

// The words a description is compared on: four letters or more, links removed, so "the" and a
// tracking URL never count as agreement (docs/features/podcast-on-youtube.md).
export function noteWords(text: string): Set<string> {
  const plain = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  return new Set(plain.match(/[a-z0-9]{4,}/g) ?? []);
}

// An episode's own words: its notes, less what the show repeats in its other episodes' notes
// (sponsor reads, links, sign-offs), which would match any upload on the channel.
export function episodeKeywords(notes: string, otherEpisodesNotes: readonly string[]): string[] {
  const shared = new Map<string, number>();
  for (const other of otherEpisodesNotes) for (const word of noteWords(other)) shared.set(word, (shared.get(word) ?? 0) + 1);
  const judging = otherEpisodesNotes.length >= FEWEST_EPISODES_TO_JUDGE_BY;
  const isBoilerplate = (word: string) => judging && (shared.get(word) ?? 0) >= SHARED_BY_SHARE_OF_EPISODES * otherEpisodesNotes.length;
  return [...noteWords(notes)].filter((word) => !isBoilerplate(word)).slice(0, MOST_KEYWORDS);
}
