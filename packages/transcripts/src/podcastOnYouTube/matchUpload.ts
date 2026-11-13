import { noteWords } from "./noteWords.js";
import { ageInDays, type ListedUpload } from "./youTubeListings.js";

export interface EpisodeToFind {
  showName: string;
  title: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  keywords: readonly string[];
}

// Each threshold was measured against a control of every episode matched to another show's
// channel (docs/features/podcast-on-youtube.md, "How sure a match is").
const TITLE_WORDS_SHARED = 0.8;
const TITLE_LENGTH_SLACK = { seconds: 180, share: 0.1 };
const CANDIDATE_LENGTH_SLACK = { seconds: 90, share: 0.03 };
const CANDIDATE_DAYS_SLACK = 3;
export const DESCRIPTION_WORDS_SHARED = 0.4;
export const DESCRIPTION_LEAD = 0.1;
export const FEWEST_KEYWORDS = 8;
export const MOST_DAYS_APART = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const titleWords = (title: string): string[] =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[a-z0-9]+/g) ?? [];

const lengthWithin = (episode: number | null, upload: number | null, slack: { seconds: number; share: number }): boolean =>
  episode !== null && upload !== null && Math.abs(episode - upload) <= Math.max(slack.seconds, slack.share * episode);

// The episode's title, nearly word for word, on an upload of nearly its length. A clip has the
// title and not the length, so it is never taken for the episode.
export function titleMatch(episode: EpisodeToFind, uploads: readonly ListedUpload[]): ListedUpload | null {
  const words = titleWords(episode.title);
  if (words.length < 2) return null;
  return (
    uploads.find((upload) => {
      const uploadWords = new Set(titleWords(upload.title));
      const shared = words.filter((word) => uploadWords.has(word)).length / words.length;
      return shared >= TITLE_WORDS_SHARED && lengthWithin(episode.durationSeconds, upload.lengthSeconds, TITLE_LENGTH_SLACK);
    }) ?? null
  );
}

export const daysAgo = (iso: string, now: Date): number => (now.getTime() - Date.parse(iso)) / DAY_MS;

// Uploads that could be the episode under another title: its length, and listed around its date.
export function retitledCandidates(episode: EpisodeToFind, uploads: readonly ListedUpload[], now: Date): ListedUpload[] {
  if (episode.publishedAt === null) return [];
  const episodeDaysAgo = daysAgo(episode.publishedAt, now);
  return uploads.filter((upload) => {
    const age = upload.age === null ? null : ageInDays(upload.age);
    return (
      age !== null &&
      lengthWithin(episode.durationSeconds, upload.lengthSeconds, CANDIDATE_LENGTH_SLACK) &&
      episodeDaysAgo >= age.fewest - CANDIDATE_DAYS_SLACK &&
      episodeDaysAgo <= age.most + CANDIDATE_DAYS_SLACK
    );
  });
}

export const descriptionShare = (keywords: readonly string[], description: string): number => {
  const words = noteWords(description);
  return keywords.length === 0 ? 0 : keywords.filter((word) => words.has(word)).length / keywords.length;
};
