import type { PodcastSource, VideoSource } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";

// The show as the channel, the notes as the description: docs/features/podcast-notes.md, "A small fork".
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

export const isPodcastInput = (input: object): input is PodcastGenerationInput => "podcast" in input;
