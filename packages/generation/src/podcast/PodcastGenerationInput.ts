import type { PodcastSource, VideoSource } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";

// A podcast episode's note is the video note in a podcast's words, so it carries the episode as the
// sections already read a video: the show as the channel, the episode's notes as the description
// (docs/features/podcast-notes.md, "A small fork").
export interface PodcastGenerationInput extends GenerationInput {
  podcast: PodcastSource;
}

const DESCRIPTION_CHARACTERS = 400;
const FULL_DESCRIPTION_CHARACTERS = 5000;

export const episodeAsVideo = (podcast: PodcastSource, notes: string): VideoSource => ({
  id: null,
  url: podcast.pageUrl ?? podcast.audioUrl,
  title: podcast.title,
  channel: podcast.showName,
  description: notes === "" ? null : notes.slice(0, DESCRIPTION_CHARACTERS),
  ...(notes === "" ? {} : { fullDescription: notes.slice(0, FULL_DESCRIPTION_CHARACTERS) }),
  durationMs: podcast.durationMs,
  publishedAt: podcast.publishedAt,
  thumbnailUrl: podcast.imageUrl,
});

export const isPodcastInput = (input: GenerationInput): input is PodcastGenerationInput => "podcast" in input;
