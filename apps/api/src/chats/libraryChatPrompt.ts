import { z } from "zod";
import { formatClock, MAX_CHAT_PICKS, overviewMarkdown, type Overview, type Project } from "@overview/domain";
import type { Passage } from "./transcriptPassages.js";
import { ANSWER_SHAPE_RULES, CHAT_REPLY_SCHEMA } from "./ChatReply.js";
import type { PromptMessage, ReplyShape } from "./streamChatCompletion.js";

// About 20,000 tokens, counted in characters by code: below it the overviews go whole and one pass
// answers, which covers small libraries and every recipe project OV-307 measured; above it, the map.
export const WHOLE_CHARACTERS = 80_000;
const RECIPE_INGREDIENTS_SHOWN = 12;
// Luna's reasoning counts against the cap, and broad questions reason longest: 300 cut off 4 in 17,
// and a 1,000-token overview answer was cut off by reasoning alone. The caps bound the worst case.
const PICK_TOKENS = 2_000;
const SECTIONED_TOKENS = 4_000;

export const PICK_SHAPE: ReplyShape = {
  name: "pick",
  maxTokens: PICK_TOKENS,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overviews"],
    properties: { overviews: { type: "array", items: { type: "string" } } },
  },
};

// The same reply every chat gives (OV-354), with room for a long, structured answer.
export const SECTIONED_SHAPE: ReplyShape = { name: "chat_reply", maxTokens: SECTIONED_TOKENS, schema: CHAT_REPLY_SCHEMA };

export const PickReply = z.object({ overviews: z.array(z.string()) });

export type LibraryChatScope = { kind: "library" } | { kind: "project"; project: Project };

export interface LibraryChatMaterial {
  mode: "whole" | "map";
  system: string;
  // O1, O2… in the order given, which the caller keeps oldest saved first so a new save lands at the end.
  labels: ReadonlyMap<string, Overview>;
}

const labelled = (label: string, overview: Overview) => overviewMarkdown(overview, { partIds: true, partIdPrefix: `${label}.` });

const briefEntry = (label: string, overview: Overview): string => {
  const ingredients =
    overview.recipe === null ? "" : `Ingredients: ${overview.recipe.ingredients.slice(0, RECIPE_INGREDIENTS_SHOWN).join("; ")}`;
  return [`## [${label}] ${overview.source.title}`, overview.bigPicture ?? "", overview.coreClaim, ingredients]
    .filter((line) => line !== "")
    .join("\n");
};

const where = (scope: LibraryChatScope): string =>
  scope.kind === "library"
    ? "their whole library in The Overview: every overview they have saved"
    : `one of their projects in The Overview, "${scope.project.name}"${scope.project.purpose === null ? "" : `, which they keep for this: "${scope.project.purpose}"`}`;

const SHAPE_AND_RULES = `${ANSWER_SHAPE_RULES}

Rules:
- A source is an overview's id, or an item's id from the full notes, such as O12.kp3. A section that compares or connects overviews lists every one of them.
- Name overviews by their titles only where the sentence needs it; the sources carry the citation.
- Never give a count of overviews or sources, or a share of them, in words or figures ("two sources", "three of your recipes"): say "a couple", "several" or "most" instead.
- Use only what the overviews say. Where you connect them, say it is your connection, not theirs.
- When nothing here covers the question, say so in the intro and leave sections empty.
- There is no single source here: always set inSource to false, and set generalKnowledge to false unless you add something from beyond these overviews, which you mark as such.`;

// OV-307's two-pass system message, which found 20 of 22 core overviews with no point drifting from
// its sources. The map serves both passes, so the second reads it from the cache. Below the
// threshold the overviews go whole and the model answers at once.
export function libraryChatMaterial(
  scope: LibraryChatScope,
  overviews: readonly Overview[],
  wholeCharacters = WHOLE_CHARACTERS,
): LibraryChatMaterial {
  const labels = new Map(overviews.map((overview, index) => [`O${index + 1}`, overview]));
  const whole = [...labels].map(([label, overview]) => `## [${label}]\n\n${labelled(label, overview)}`);
  const mode = whole.join("\n\n").length <= wholeCharacters ? "whole" : "map";
  const system =
    mode === "whole"
      ? `You answer a reader's questions about ${where(scope)}, listed below in full. Each overview has an id (O1, O2 and so on), and its items carry their own ids (such as O12.kp3).

${SHAPE_AND_RULES}

# The overviews

${whole.join("\n\n")}`
      : `You answer a reader's questions about ${where(scope)}, listed below in brief. Each overview has an id (O1, O2 and so on) and shows its title, its big picture and its core claim; a recipe shows its ingredients.

Sometimes you are first asked to choose the overviews whose full notes you need. Choose up to ${MAX_CHAT_PICKS}, the ones the answer will rest on, and return their ids. You may then be given those overviews in full, with their items' ids (such as O12.kp3).

${SHAPE_AND_RULES}

# The overviews

${[...labels].map(([label, overview]) => briefEntry(label, overview)).join("\n\n")}`;
  return { mode, system, labels };
}

export const pickPrompt = (question: string): PromptMessage => ({
  role: "user",
  content: `Choose the overviews whose full notes you need to answer this question: ${question}`,
});

// A large project's keyword minutes (OV-352): each a minute of a member's transcript with an id,
// such as O3.p14, that a point lists in its sources.
export const minutesBlock = (minutes: ReadonlyArray<readonly [string, Overview, readonly Passage[]]>): PromptMessage => ({
  role: "user",
  content: `Minutes of their transcripts that match the question's words. Each has an id (such as O3.p14); a point that rests on one lists it in its sources.\n\n${minutes
    .map(
      ([label, overview, passages]) =>
        `## [${label}] ${overview.source.title}\n\n${passages.map((passage) => `[${label}.${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`).join("\n")}`,
    )
    .join("\n\n")}`,
});

export const pickedBlock = (picked: ReadonlyArray<readonly [string, Overview]>): PromptMessage => ({
  role: "user",
  content: `The full notes of the overviews you chose:\n\n${picked.map(([label, overview]) => `## [${label}]\n\n${labelled(label, overview)}`).join("\n\n")}`,
});
