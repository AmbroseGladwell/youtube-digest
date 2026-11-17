import { answeredFromOverviewAlone, formatClock, type ChatSourceKind } from "@overview/domain";
import type { OtherChatsInPrompt } from "./otherChatsInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

const passageBlock = (passage: Passage): string => `[${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`;

// OV-267's fullTranscript shape, which cited the right moment on 46 of 48 questions and
// declined all 24 the source didn't answer, with the overview's items given ids so an answer
// can cite them too (OV-319). It is the first message and never changes within a
// conversation, so every follow-up reads it from the cache (docs/architecture/in-app-chat.md).
// The overview comes from overviewMarkdown with partIds.
export function chatSystemPrompt(kind: ChatSourceKind, overview: string, passages: readonly Passage[], { recipe = false } = {}): string {
  if (answeredFromOverviewAlone(kind)) return overviewOnlyPrompt(kind, overview);
  return `You answer a reader's questions about one ${kind} they saved in The Overview, and about the overview The Overview wrote of it.

Answer only from the material below: the overview and the transcript. Never answer from general knowledge, even when you know the answer. Answer in two to five plain sentences.
- When the transcript answers the question, set inSource to true and list in passages the ids (such as p12) of the transcript passages that support the answer.
- When the answer rests on an item of the overview, list its id (such as step2, dubious1 or apply1) in overviewParts. Items with ids are the verdict, why it is dubious, key points, the steps it gives, How to apply, what it sells, whether to watch it anyway, chapters, and a recipe's ingredients and method. When the transcript backs the same point, cite its passages as well.
- The verdict, why it is dubious, what it sells and whether to watch it anyway are the overview's own judgement of the ${kind}, not something the ${kind} says. Answer a question about them from the item, and cite the passage it refers to where the transcript has one.
- How to apply suggests what the reader might do, and may go beyond the ${kind}. When you answer from it, give the suggestion and add a short clause such as "That goes beyond the ${kind}, which doesn't cover how to try it." when the ${kind} doesn't.
- Never speak of the overview as a third party ("the overview suggests", "its judgement") and never in the first person. Give the answer itself, and mark a line only against the ${kind} ("the ${kind} doesn't say"). When the question is about a section, name it as the subject: "Watch it anyway says…", "Start with Step 1…", "It's marked dubious because…".
- inSource is about the transcript alone: set it to false when the transcript doesn't back the answer, even when the overview does.
- When neither the transcript nor the overview answers the question, set inSource to false, say plainly that the ${kind} doesn't cover it, and leave passages and overviewParts empty.
- Cite only ids that appear in the material. The premise, big picture and core claim have no ids: for those, cite the transcript.
${recipe ? `${AMOUNTS_RULE}\n` : ""}
# The overview

${overview}

# The transcript

${transcriptBlocks(passages)}`;
}

// "Never let a model count, measure or time anything" (docs/prototype/constraints.md): amounts
// for other servings come from the recipe's own scaler (OV-231), never from the answer.
const AMOUNTS_RULE =
  "- Never work out an amount yourself: never scale a quantity, change the number of servings, or convert a unit, weight or temperature. Give the recipe's own amounts and cite them, and when the question wants other amounts, say the servings control above the ingredients changes them.";

const NOUN: Record<"article" | "recipe", string> = { article: "article", recipe: "recipe page" };

// An article or a recipe page: we keep no page text (OV-295), so the overview, and a recipe
// page's recipe, are all an answer can come from (OV-320).
function overviewOnlyPrompt(kind: "article" | "recipe", overview: string): string {
  const noun = NOUN[kind];
  const decline = kind === "recipe" ? "the recipe doesn't cover it" : "the overview of this article doesn't cover it";
  const examples = kind === "recipe" ? "ing3 or method2" : "kp2, ch1 or apply1";
  const judgement =
    kind === "article"
      ? `- The verdict, why it is dubious, what it sells and Read it anyway are the overview's own judgement of the article, not something the article says. Answer a question about them from the item.
- How to apply suggests what the reader might do, and may go beyond the article. When you answer from it, give the suggestion and add a short clause such as "That goes beyond the article, which doesn't cover how to try it." when the article doesn't.
`
      : `${AMOUNTS_RULE}\n`;
  return `You answer a reader's questions about one ${noun} they saved in The Overview, from the overview The Overview wrote of it. The page's own text isn't kept, so the overview is all there is to answer from.

Answer only from the overview below. Never answer from general knowledge, even when you know the answer. Answer in two to five plain sentences.
- List in overviewParts the ids (such as ${examples}) of the items the answer rests on. There is no transcript: always set inSource to false and leave passages empty.
${judgement}- Never speak of the overview as a third party ("the overview suggests", "its judgement") and never in the first person. Give the answer itself. When the question is about a section, name it as the subject: ${kind === "recipe" ? '"Step 2 of the method…", "The ingredients list…"' : '"Read it anyway says…", "The chapter on costs…", "It\'s marked dubious because…"'}.
- When the overview doesn't answer the question, say plainly that ${decline}, and leave overviewParts empty. That includes anything only the full ${kind === "recipe" ? "page" : "article"} would say.
- Cite only ids that appear in the overview. The premise, big picture, core claim and summary have no ids.

# The overview

${overview}`;
}

const transcriptBlocks = (passages: readonly Passage[]): string => passages.map(passageBlock).join("\n");

// After the transcript, so a new message in another chat leaves the transcript's cache whole,
// and as a user message: a second system message is folded into the first, and the transcript
// is then no longer the cached prefix a new conversation reads (OV-313's probe).
export function otherChatsPrompt(kind: ChatSourceKind, others: OtherChatsInPrompt): string | null {
  if (others.conversations.length === 0) return null;
  return `# The reader's other conversations about this ${kind}

Earlier conversations the reader had about the same ${kind}. Use them when the question refers to something the reader asked, decided or was told there, and list in chatMessages the ids (such as c1.m3) of the messages you used. They are not the source: ${answeredFromOverviewAlone(kind) ? "anything about the " + kind + " must still cite the overview's items" : `anything about what the ${kind} says must still cite transcript passages`}, and an answer that rests only on these conversations has inSource false.

${others.conversations
  .map(
    (conversation) =>
      `## Conversation ${conversation.label}, started ${conversation.startedAt.slice(0, 10)}\n\n${conversation.lines.map((line) => `[${line.label} ${line.from}] ${line.text}`).join("\n")}`,
  )
  .join("\n\n")}`;
}
