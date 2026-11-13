import { z } from "zod";
import { keyPointsCoverALongVideo, WRITING_RULES, type ComposedPrompt } from "../composePrompt.js";
import { descriptionOf } from "../recipe/videoRecipe.js";
import { enabledSections } from "../sectionRegistry.js";
import { inPodcastWords } from "./inPodcastWords.js";
import { listenAnywaySection } from "./listenAnywaySection.js";
import type { PodcastGenerationInput } from "./PodcastGenerationInput.js";

export type PodcastNoteKind = "default" | "process";

const OPENING =
  "You produce a blunt judgment record of a saved podcast episode for one reader, from its transcript alone. Follow the sections below exactly. ";

const EPISODE_TAG = /<(\/?)(episode|title|show|notes|transcript)\b/gi;

const asEpisodeContent = (text: string): string => text.replace(EPISODE_TAG, "‹$1$2");

function contextBlock(input: PodcastGenerationInput): string {
  const transcript = input.transcript.map((segment, i) => `[${i}] ${asEpisodeContent(segment.text)}`).join("\n");
  const notes = descriptionOf(input);
  return `
<episode>
<title>${asEpisodeContent(input.podcast.title)}</title>
<show>${asEpisodeContent(input.podcast.showName)}</show>
<notes>${notes === "" ? "unavailable" : asEpisodeContent(notes)}</notes>
<transcript>
${transcript}
</transcript>
</episode>

Why they saved it: ${input.captureReason ?? "not said"}`;
}

// The video note's sections in a podcast's words, with Listen to it anyway in place of Watch it
// anyway. A podcast has no recipe note: one that teaches a dish gets the default note
// (docs/features/podcast-notes.md).
export function composePodcastPrompt(input: PodcastGenerationInput, kind: PodcastNoteKind = "default"): ComposedPrompt {
  const sections = enabledSections(input, kind).map((section) => (section.key === "watchAnyway" ? listenAnywaySection : section));
  const shape: Record<string, z.ZodType> = {};
  for (const section of sections) {
    const sectionShape = section.schemaShape(input);
    if (section.key === "structural") Object.assign(shape, sectionShape);
    else shape[section.key] = z.object(sectionShape);
  }
  return {
    systemPrompt: OPENING + WRITING_RULES + sections.map((section) => inPodcastWords(section.prompt(input))).join("\n"),
    userMessage: contextBlock(input),
    schema: z.object(shape).superRefine(keyPointsCoverALongVideo(input, "episode")),
  };
}
