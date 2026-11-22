import { z } from "zod";
import { chatSourceKind, formatClock, MAX_CHAT_PICKS, overviewMarkdown, type Overview, type Project } from "@overview/domain";
import type { Passage } from "./transcriptPassages.js";
import { ANSWER_SHAPE_RULES, CHAT_REPLY_SCHEMA } from "./ChatReply.js";
import { NO_MARKS, type OverviewMarks } from "./planScope.js";
import type { PromptMessage, ReplyShape } from "./streamChatCompletion.js";

// About 20,000 tokens, counted in characters by code: below it the overviews go whole and one pass
// answers, which covers small libraries and every recipe project OV-307 measured; above it, the map.
export const WHOLE_CHARACTERS = 80_000;
const RECIPE_INGREDIENTS_SHOWN = 12;
// Luna's reasoning counts against the cap, and broad questions reason longest: 300 cut off 4 in 17,
// and a 1,000-token overview answer was cut off by reasoning alone. The caps bound the worst case.
const PICK_TOKENS = 2_000;
const PLAN_TOKENS = 3_000;
const SECTIONED_TOKENS = 4_000;
// OV-373: an answer that places every overview in scope ran to 7,800 tokens for 89 of them.
const BROAD_TOKENS = 16_000;
const WORDS_A_MINUTE = 238;

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

// An answer that has to cover many overviews, or every overview of a small library sent whole.
export const BROAD_SHAPE: ReplyShape = { ...SECTIONED_SHAPE, maxTokens: BROAD_TOKENS };

export const PLAN_SHAPE: ReplyShape = {
  name: "plan",
  maxTokens: PLAN_TOKENS,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["filters", "mode", "picks"],
    properties: {
      filters: {
        type: "object",
        additionalProperties: false,
        required: ["read", "favourite", "kinds", "topics", "savedFrom", "savedTo", "novelty"],
        properties: {
          read: { type: "string", enum: ["unread", "read", "any"] },
          favourite: { type: "string", enum: ["only", "any"] },
          kinds: { type: "array", items: { type: "string", enum: ["video", "article", "recipe", "episode"] } },
          topics: { type: "array", items: { type: "string" } },
          savedFrom: { type: "string" },
          savedTo: { type: "string" },
          novelty: { type: "array", items: { type: "string", enum: ["common_knowledge", "fresh_angle", "original"] } },
        },
      },
      mode: { type: "string", enum: ["deep", "broad"] },
      picks: { type: "array", items: { type: "string" } },
    },
  },
};

export type LibraryChatScope = { kind: "library" } | { kind: "project"; project: Project };

export interface LibraryChatContext {
  marks?: ReadonlyMap<string, OverviewMarks>;
  topics?: readonly string[];
}

export interface LibraryChatMaterial {
  mode: "whole" | "map";
  system: string;
  // O1, O2… in the order given, which the caller keeps oldest saved first so a new save lands at the end.
  labels: ReadonlyMap<string, Overview>;
}

const labelled = (label: string, overview: Overview) => overviewMarkdown(overview, { partIds: true, partIdPrefix: `${label}.` });

const minutesOf = ({ source }: Overview): number | null => {
  if (source.kind === "web") {
    return Math.max(1, Math.round(source.wordCount / WORDS_A_MINUTE));
  }
  return source.durationMs === null ? null : Math.max(1, Math.round(source.durationMs / 60_000));
};

const lengthOf = (overview: Overview): string | null => {
  const minutes = minutesOf(overview);
  if (minutes === null) {
    return null;
  }
  const kind = chatSourceKind(overview);
  return kind === "article" || kind === "recipe" ? `${minutes} min read` : `${minutes} min`;
};

// OV-373: what a reader filters and ranks by, set by code, on one line under each title.
export const factsLine = (overview: Overview, marks: OverviewMarks): string => {
  return [
    chatSourceKind(overview),
    lengthOf(overview),
    `saved ${overview.savedAt.slice(0, 10)}`,
    overview.verdict === null ? null : overview.verdict.novelty.replace("_", " "),
    overview.verdict?.dubious === true ? "dubious" : null,
    overview.watchAnyway === null ? null : `watch it anyway: ${overview.watchAnyway.answer}`,
    marks.topics.length === 0 ? null : `topics: ${marks.topics.join(", ")}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
};

const briefEntry = (label: string, overview: Overview, marks: OverviewMarks): string => {
  const ingredients =
    overview.recipe === null ? "" : `Ingredients: ${overview.recipe.ingredients.slice(0, RECIPE_INGREDIENTS_SHOWN).join("; ")}`;
  return [`## [${label}] ${overview.source.title}`, factsLine(overview, marks), overview.bigPicture ?? "", overview.coreClaim, ingredients]
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
- There is no single source here: always set inSource to false, and set generalKnowledge to false unless you add something from beyond these overviews, which you mark as such.
- When the answer covers many overviews (every unread one, every one on a topic, a ranking), every overview it covers appears in the sources of a list item, so none is left out silently. Group them: one item may carry many sources when they share a reason.`;

const FACTS = `Each overview also has a line of facts: its kind, its length, the day it was saved, how new its ideas are, whether its claims are dubious, whether it is worth watching anyway, and its topics. The reader's read and favourite marks come in a message of their own.`;

// OV-307's two-pass system message, which found 20 of 22 core overviews with no point drifting from
// its sources. The map serves both passes, so the second reads it from the cache. Below the
// threshold the overviews go whole and the model answers at once.
export const libraryChatMaterial = (
  scope: LibraryChatScope,
  overviews: readonly Overview[],
  wholeCharacters = WHOLE_CHARACTERS,
  { marks = new Map(), topics = [] }: LibraryChatContext = {},
): LibraryChatMaterial => {
  const labels = new Map(overviews.map((overview, index) => [`O${index + 1}`, overview]));
  const marksOf = (overview: Overview) => marks.get(overview.id) ?? NO_MARKS;
  const whole = [...labels].map(
    ([label, overview]) => `## [${label}]\n\n${factsLine(overview, marksOf(overview))}\n\n${labelled(label, overview)}`,
  );
  const mode = whole.join("\n\n").length <= wholeCharacters ? "whole" : "map";
  const system =
    mode === "whole"
      ? `You answer a reader's questions about ${where(scope)}, listed below in full. Each overview has an id (O1, O2 and so on), and its items carry their own ids (such as O12.kp3). ${FACTS}

${SHAPE_AND_RULES}

# The overviews

${whole.join("\n\n")}`
      : `You answer a reader's questions about ${where(scope)}, listed below in brief. Each overview has an id (O1, O2 and so on) and shows its title, its big picture and its core claim; a recipe shows its ingredients. ${FACTS}

Before answering you are asked for a plan:
- filters: narrow the overviews to the ones the question is about, using only these: read ("unread", "read" or "any"), favourite ("only" or "any"), kinds (video, article, recipe, episode), topics (exact names from the list below), savedFrom and savedTo (YYYY-MM-DD, or empty), novelty (common_knowledge, fresh_angle, original). Leave a filter at "any" or empty unless the question asks for it. Code applies them exactly.
- mode: "broad" when the answer has to cover, sort or rank many overviews; "deep" when it rests on a few.
- picks: up to ${MAX_CHAT_PICKS} overviews whose full notes the answer will rest on, from inside the filters.
You are then given the ids code kept after your filters, and the overviews you picked in full, with their items' ids (such as O12.kp3).

${SHAPE_AND_RULES}

# Topics

${topics.length === 0 ? "None yet." : topics.join("; ")}

# The overviews

${[...labels].map(([label, overview]) => briefEntry(label, overview, marksOf(overview))).join("\n\n")}`;
  return { mode, system, labels };
};

// The reader's marks, after the map rather than on it, so marking an overview read doesn't change
// the cached map.
export const marksBlock = (labels: ReadonlyMap<string, Overview>, marks: ReadonlyMap<string, OverviewMarks>): PromptMessage => {
  const which = (keep: (mark: OverviewMarks) => boolean) =>
    [...labels]
      .filter(([, overview]) => keep(marks.get(overview.id) ?? NO_MARKS))
      .map(([label]) => label)
      .join(", ") || "none";
  return {
    role: "user",
    content: `The reader's marks. Unread: ${which((mark) => !mark.read)}.\nFavourites: ${which((mark) => mark.favourite)}.`,
  };
};

export const planPrompt = (question: string): PromptMessage => ({
  role: "user",
  content: `Plan the answer to this question: ${question}`,
});

export const scopeBlock = (kept: readonly string[]): PromptMessage => ({
  role: "user",
  content:
    kept.length === 0
      ? "Your filters kept none of the overviews. Say so, and answer from nothing else."
      : `The overviews code kept after your filters: ${kept.join(", ")}. Answer from these alone.`,
});

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
