import type { Overview } from "@overview/domain";
import { z } from "zod";
import type { ReplyShape } from "../chats/streamChatCompletion.js";
import { labelledClaimsOf, type ClaimField } from "../meaning/labelledClaimsOf.js";

const RELATIONS = ["same_claim", "builds_on", "contradicts", "different_view", "shared_idea", "same_topic_only", "unrelated"] as const;
const VERDICTS = ["real", "stretch", "not_connected"] as const;

export const TENSIONS: ReadonlySet<string> = new Set(["different_view", "contradicts"]);

export const PairLabel = z.object({
  relation: z.enum(RELATIONS),
  verdict: z.enum(VERDICTS),
  reason: z.string(),
});
export type PairLabel = z.infer<typeof PairLabel>;

const LABEL_TOKENS = 4_000;

export const PAIR_LABEL_SHAPE: ReplyShape = {
  name: "pair_label",
  maxTokens: LABEL_TOKENS,
  schema: {
    type: "object",
    properties: {
      relation: { type: "string", enum: [...RELATIONS] },
      verdict: { type: "string", enum: [...VERDICTS] },
      reason: { type: "string" },
    },
    required: ["relation", "verdict", "reason"],
    additionalProperties: false,
  },
};

const RELATION_GUIDE = `Relations:
- same_claim: both notes make essentially the same claim.
- builds_on: one note's idea extends, applies or gives the mechanism behind the other's.
- contradicts: the notes disagree on a specific claim of fact.
- different_view: both address the same question or decision and reach different answers, or recommend different approaches to it.
- shared_idea: different subjects that rest on the same underlying idea, so reading one sheds light on the other.
- same_topic_only: same subject area, but no idea, question or disagreement in common worth pointing out.
- unrelated: nothing meaningful in common.`;

const VERDICT_GUIDE = `verdict:
- real: a thoughtful reader would agree these ideas connect, and seeing the link would be useful. Two notes answering the same question differently is a real connection.
- stretch: there is a link, but it is generic, thin or forced.
- not_connected: no connection beyond, at most, a shared subject.`;

// The strict rubric measured in docs/features/connections.md, round 2, without its "for you" line.
export const LABEL_PROMPT = `You link notes in one reader's library of overviews of videos, articles and podcasts, but only when their ideas genuinely connect. You see what is known about the reader, then two notes.

${RELATION_GUIDE}

${VERDICT_GUIDE}
Most pairs that share a subject are stretch or not_connected. Say real only when a specific idea in one note changes or sharpens how the reader would read the other, or when the two answer the same question differently.

reason: one sentence, at most 30 words, naming the specific idea the two share, or for different_view and contradicts, what each says. Use only what the notes say.
- Never say one note extends, sharpens, applies, explains or makes concrete the other, unless one note itself says so. Say what each says instead.
- Name the idea, not the subject. "Both are about AI and work" is not a reason.
- Never start with "Both".`;

const CLAIM_NAMES: Record<ClaimField, string> = {
  bigPicture: "Big picture",
  coreClaim: "Core claim",
  keyPoint: "Key point",
  recipe: "Recipe",
};

const CLAIM_IDS: Record<Exclude<ClaimField, "keyPoint">, string> = { bigPicture: "bp", coreClaim: "core", recipe: "recipe" };

const claimIdsOf = (overview: Overview): string[] => {
  let keyPoint = 0;
  return labelledClaimsOf(overview).map(({ field }) => {
    if (field === "keyPoint") {
      keyPoint += 1;
      return `kp${keyPoint}`;
    }
    return CLAIM_IDS[field];
  });
};

const noteBlock = (label: string, overview: Overview): string => {
  const ids = claimIdsOf(overview);
  const lines = labelledClaimsOf(overview).map((claim, index) => {
    const name = claim.field === "keyPoint" ? `Key point ${ids[index]}` : CLAIM_NAMES[claim.field];
    return `- [${ids[index]}] ${name}: ${claim.text}`;
  });
  return [`## ${label}: ${overview.source.title} (${overview.source.kind})`, ...lines].join("\n");
};

export const pairNotes = (first: Overview, second: Overview): string => `${noteBlock("Note A", first)}\n\n${noteBlock("Note B", second)}`;

// The core claim, and the claim the pair met on when it isn't the core claim.
export const compactNote = (overview: Overview, position: number): string => {
  const closest = labelledClaimsOf(overview)[position];
  const point = closest === undefined || closest.field === "coreClaim" ? "" : ` Closest point: ${closest.text}`;
  return `"${overview.source.title}": ${overview.coreClaim}${point}`;
};
