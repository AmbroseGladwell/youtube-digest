export interface EpisodeFacts {
  title: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MOST_DAYS_APART = 2;

export const episodeTitleKey = (title: string): string =>
  title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const datesAgree = (a: string | null, b: string | null): boolean =>
  a === null || b === null || Math.abs(Date.parse(a) - Date.parse(b)) <= MOST_DAYS_APART * DAY_MS;

const lengthsAgree = (a: number | null, b: number | null): boolean =>
  a === null || b === null || Math.abs(a - b) <= Math.max(60, 0.02 * Math.max(a, b));

// The same episode named from two places: the same title, and nothing known that disagrees.
// A show that reruns an episode under its old title is told apart by the date
// (docs/features/podcast-links.md, "Matching an episode").
export function sameEpisode(wanted: EpisodeFacts, candidate: EpisodeFacts): boolean {
  if (wanted.title === null || candidate.title === null) return false;
  const key = episodeTitleKey(wanted.title);
  return (
    key !== "" &&
    key === episodeTitleKey(candidate.title) &&
    datesAgree(wanted.publishedAt, candidate.publishedAt) &&
    lengthsAgree(wanted.durationSeconds, candidate.durationSeconds)
  );
}

export function pickEpisode<T extends EpisodeFacts>(wanted: EpisodeFacts, candidates: readonly T[]): T | null {
  const matches = candidates.filter((candidate) => sameEpisode(wanted, candidate));
  if (matches.length <= 1 || wanted.publishedAt === null) return matches[0] ?? null;
  const target = Date.parse(wanted.publishedAt);
  const distance = (candidate: T) => (candidate.publishedAt === null ? Infinity : Math.abs(Date.parse(candidate.publishedAt) - target));
  return matches.reduce((best, candidate) => (distance(candidate) < distance(best) ? candidate : best));
}
