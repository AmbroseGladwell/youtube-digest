import { z } from "zod";
import { HowToApply, resolveTags, type Overview } from "@overview/domain";
import {
  WRITING_RULES,
  filingSection,
  howToApplySection,
  type GenerationInput,
  type SuggestedTopicShape,
} from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { noteForJudging } from "./judgeRubric.js";
import type { ReaderProfile } from "./ReaderProfile.js";

export interface PersonalOutput {
  howToApply: { items: string[] };
  matchedTopicNames: string[];
  suggestedTopic: SuggestedTopicShape | null;
  tags: string[];
  similarToIndices: number[];
}

export const sharedPartOf = (overview: Overview): Overview => ({
  ...overview,
  captureReason: null,
  topicIds: [],
  tags: [],
  howToApply: null,
  verdict: overview.verdict === null ? null : { ...overview.verdict, similarTo: [] },
});

const similarClaimsInstructions = (profile: ReaderProfile) => `
## Similar past claims
Here are the reader's past claims, by index:
${
  profile.pastClaims.length === 0
    ? "The reader has no past overviews yet."
    : profile.pastClaims.map((claim, i) => `${i}. ${claim.title}: ${claim.claim}`).join("\n")
}
List the indices (if any) whose claim this video repeats, as similarToIndices.`;

export function personalisePrompt(
  fetched: FetchedTranscript,
  profile: ReaderProfile,
  shared: Overview,
  withTranscript: boolean,
) {
  const input: GenerationInput = {
    ...profile,
    video: fetched.video,
    transcript: withTranscript ? fetched.transcript : [],
    sectionsEnabled: { verdict: true, selling: true, howToApply: true, watchAnyway: true },
  };
  const transcript = withTranscript
    ? `\n\nTranscript, as numbered segments:\n${fetched.transcript.map((segment, i) => `[${i}] ${segment.text}`).join("\n")}`
    : "";

  return {
    systemPrompt:
      "You personalise a judgment record of a saved video for one reader. The shared note below " +
      `already says what the video claims and whether it holds up; add only the reader's own parts. ${WRITING_RULES}` +
      howToApplySection.prompt(input) +
      filingSection.prompt(input) +
      similarClaimsInstructions(profile),
    userMessage: `Title: ${fetched.video.title}
Channel: ${fetched.video.channel}
Description: ${fetched.video.description ?? "unavailable"}
Why they saved it: ${profile.captureReason ?? "not said"}

The shared note:
${noteForJudging(sharedPartOf(shared))}${transcript}`,
    schema: z.object({
      howToApply: z.object(howToApplySection.schemaShape(input)),
      ...filingSection.schemaShape(input),
      similarToIndices:
        profile.pastClaims.length === 0
          ? z.array(z.int()).max(0)
          : z.array(z.int().min(0).max(profile.pastClaims.length - 1)),
    }),
  };
}

export function personalisedOverview(shared: Overview, profile: ReaderProfile, output: PersonalOutput): Overview {
  const base = sharedPartOf(shared);
  return {
    ...base,
    captureReason: profile.captureReason,
    topicIds: profile.existingTopics
      .filter((topic) => output.matchedTopicNames.includes(topic.name))
      .map((topic) => topic.id),
    tags: resolveTags(output.tags, {
      known: new Set(profile.existingTags.map(({ tag }) => tag)),
      aliases: profile.tagAliases,
    }),
    howToApply: HowToApply.parse(output.howToApply),
    verdict:
      base.verdict === null
        ? null
        : {
            ...base.verdict,
            similarTo: [...new Set(output.similarToIndices)]
              .filter((i) => i >= 0 && i < profile.pastClaims.length)
              .map((i) => ({ overviewId: profile.pastClaims[i]!.overviewId, title: profile.pastClaims[i]!.title })),
          },
  };
}
