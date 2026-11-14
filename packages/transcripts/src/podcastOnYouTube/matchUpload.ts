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
export const MOST_DESCRIPTIONS_READ = 5;
const CHANNEL_NAME_WORDS_SHARED = 0.6;

const DAY_MS = 24 * 60 * 60 * 1000;

const titleWords = (title: string): string[] =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[a-z0-9]+/g) ?? [];

const lengthWithin = (episode: number | null, upload: number | null, slack: { seconds: number; share: number }): boolean =>
  episode !== null && upload !== null && Math.abs(episode - upload) <= Math.max(slack.seconds, slack.share * episode);

// "Part 2" and "Part 1" share every word but one. A number on one side only is fine, since
// shows drop the episode number on YouTube; a different number on each side is another episode.
const numbersDisagree = (a: readonly string[], b: readonly string[]): boolean => {
  const numbersOf = (words: readonly string[]) => new Set(words.filter((word) => /^\d+$/.test(word)));
  const [left, right] = [numbersOf(a), numbersOf(b)];
  return [...left].some((number) => !right.has(number)) && [...right].some((number) => !left.has(number));
};

// The episode's title, nearly word for word, on an upload of nearly its length. A clip has the
// title and not the length, so it is never taken for the episode.
export function titleMatch<Upload extends ListedUpload>(episode: EpisodeToFind, uploads: readonly Upload[]): Upload | null {
  const words = titleWords(episode.title);
  if (words.length < 2) return null;
  return (
    uploads.find((upload) => {
      const uploadWords = titleWords(upload.title);
      const uploadSet = new Set(uploadWords);
      const shared = words.filter((word) => uploadSet.has(word)).length / words.length;
      return (
        shared >= TITLE_WORDS_SHARED &&
        !numbersDisagree(words, uploadWords) &&
        lengthWithin(episode.durationSeconds, upload.lengthSeconds, TITLE_LENGTH_SLACK)
      );
    }) ?? null
  );
}

export const retitledLengthMatches = (episode: EpisodeToFind, uploadSeconds: number | null): boolean =>
  lengthWithin(episode.durationSeconds, uploadSeconds, CANDIDATE_LENGTH_SLACK);

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

const nameWords = (name: string): string[] =>
  name
    .toLowerCase()
    .split(":")[0]!
    .match(/[a-z0-9]+/g) ?? [];

// The channel is the show's own: most of the show's name, before any subtitle, in the channel's.
export const namesTheShow = (channelTitle: string, showName: string): boolean => {
  const show = nameWords(showName);
  const channelWords = new Set(nameWords(channelTitle));
  return show.length > 0 && show.filter((word) => channelWords.has(word)).length / show.length >= CHANNEL_NAME_WORDS_SHARED;
};
