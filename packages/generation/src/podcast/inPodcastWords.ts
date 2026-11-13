// The video sections' wording, said of an episode. Applied to the podcast prompt alone, so a video's
// prompt is never touched by it, and a test fails when a section gains a video word this table
// doesn't cover (docs/features/podcast-notes.md, "A small fork").
const PODCAST_WORDS: readonly (readonly [RegExp, string])[] = [
  [/\bA video\b/g, "An episode"],
  [/\ba video\b/g, "an episode"],
  [/\bthe description\b/g, "the episode's notes"],
  [/\btalking head\b/g, "conversation"],
  [/\bvideos\b/g, "episodes"],
  [/\bVideos\b/g, "Episodes"],
  [/\bvideo\b/g, "episode"],
  [/\bVideo\b/g, "Episode"],
  [/\bwatching\b/g, "listening to"],
  [/\bwatched\b/g, "listened to"],
  [/\bwatch\b/g, "listen to"],
  [/\bWatch\b/g, "Listen to"],
  [/\bviewers\b/g, "listeners"],
  [/\bviewer\b/g, "listener"],
  [/\bchannel's\b/g, "show's"],
  [/\bchannel\b/g, "show"],
];

export const VIDEO_WORDS = /\b(videos?|watch(ing|ed)?|viewers?|channel('s)?)\b/i;

export const inPodcastWords = (text: string): string =>
  PODCAST_WORDS.reduce((said, [videoWord, podcastWord]) => said.replace(videoWord, podcastWord), text);
