import { answeredFromOverviewAlone, formatClock, type ChatSourceKind } from "@overview/domain";
import { ANSWER_SHAPE_RULES } from "./ChatReply.js";
import type { OtherChatsInPrompt } from "./otherChatsInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

const passageBlock = (passage: Passage): string => `[${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`;

// OV-267's fullTranscript shape, which cited the right moment on 46 of 48 questions and
// declined all 24 the source didn't answer, with the overview's items given ids so an answer
// can cite them too (OV-319). It is the first message and never changes within a
// conversation, so every follow-up reads it from the cache (docs/architecture/in-app-chat.md).
// The overview comes from overviewMarkdown with partIds.
export function chatSystemPrompt(
  kind: ChatSourceKind,
  overview: string,
  passages: readonly Passage[],
  { recipe = false, reader = null }: { recipe?: boolean; reader?: string | null } = {},
): string {
  const prompt = answeredFromOverviewAlone(kind) ? overviewOnlyPrompt(kind, overview) : sourcePrompt(kind, overview, passages, recipe);
  return `${prompt}\n\n${reader === null ? NOTHING_KNOWN : readerBlock(kind, reader)}`;
}

// With nothing known the block is the same for every reader, so it caches with the rest.
const NOTHING_KNOWN = `# The reader

Nothing is known about the reader yet: they haven't written an About you sentence, and nothing has been noticed in the overviews they save.

- Never assume anything about them.
- When they ask what you know about them, say nothing yet, and that they can tell The Overview about themselves in Settings › Personalisation, so answers and How to apply fit them.`;

// OV-343: the reader context generation gives How to apply (composeReaderContext), so chat
// fits answers to the same person the note was written for. Last in the system message, so a
// changed profile leaves the transcript's cached prefix whole.
function readerBlock(kind: ChatSourceKind, reader: string): string {
  const noun = NOUN[kind];
  return `# The reader

What The Overview knows about the reader, from the About you sentence they wrote and what it has noticed in the overviews they save:

${reader}

- Use it to fit an answer to them: which part matters most to them, and how they might try something. How to apply was written for this reader too.
- Fit what they already do and the limits they live with. Never give them a new project, role or occasion, and never assume more about them than this says.
- Never let it change what the ${noun} says, and never say the ${noun} says something because it fits them. Fitting an answer to them is not citing anything.
- When they ask what you know about them, say what is here in plain words, and that they can see, change or remove it in Settings › Personalisation.`;
}

function sourcePrompt(kind: ChatSourceKind, overview: string, passages: readonly Passage[], recipe: boolean): string {
  return `You answer a reader's questions about one ${kind} they saved in The Overview, and about the overview The Overview wrote of it.

Answer from the material below: the overview and the transcript. Answer from general knowledge only as the rules below allow.
- When the transcript answers the question, set inSource to true and list as sources the ids (such as p12) of the transcript passages that support each part of the answer.
- When the answer rests on an item of the overview, list its id (such as step2, dubious1 or apply1) as a source. Items with ids are the verdict, why it is dubious, key points, the steps it gives, How to apply, what it sells, whether to watch it anyway, chapters, and a recipe's ingredients and method. When the transcript backs the same point, cite its passages as well.
- The verdict, why it is dubious, what it sells and whether to watch it anyway are the overview's own judgement of the ${kind}, not something the ${kind} says. Answer a question about them from the item, and cite the passage it refers to where the transcript has one.
- How to apply suggests what the reader might do, and may go beyond the ${kind}. When you answer from it, give the suggestion and add a short clause such as "That goes beyond the ${kind}, which doesn't cover how to try it." when the ${kind} doesn't.
- Never speak of the overview as a third party ("the overview suggests", "its judgement") and never in the first person. Give the answer itself, and mark a line only against the ${kind} ("the ${kind} doesn't say"). When the question is about a section, name it as the subject: "Watch it anyway says…", "Start with Step 1…", "It's marked dubious because…".
- inSource is about the transcript alone: set it to false when the transcript doesn't back the answer, even when the overview does.
${beyondSourceRules({ noun: kind, material: "the transcript nor the overview", decline: `the ${kind} doesn't cover it`, cited: "the sources" })}
- Cite only ids that appear in the material. The premise, big picture and core claim have no ids: for those, cite the transcript.
${recipe ? `${AMOUNTS_RULE}\n` : ""}
${ANSWER_SHAPE_RULES}

${productBlock(kind, `this overview, the ${kind}'s transcript`, !recipe)}

# The overview

${overview}

# The transcript

${transcriptBlocks(passages)}`;
}

// "Never let a model count, measure or time anything" (docs/prototype/constraints.md): amounts
// for other servings come from the recipe's own scaler (OV-231), never from the answer.
const AMOUNTS_RULE =
  "- Never work out an amount yourself: never scale a quantity, change the number of servings, or convert a unit, weight or temperature. Give the recipe's own amounts and cite them, and when the question wants other amounts, say the servings control above the ingredients changes them.";

// OV-329: a fair question the source doesn't cover gets a short answer from general knowledge,
// said to be from beyond it, rather than a refusal. The app labels it from its citations, never
// from generalKnowledge, which only tells a general answer from a decline in the log line.
function beyondSourceRules({ noun, material, decline, cited }: { noun: string; material: string; decline: string; cited: string }): string {
  const opening = decline.charAt(0).toUpperCase() + decline.slice(1);
  return `- When neither ${material} answers the question but it is a fair question about the ${noun}'s subject (why something works, what something means, whether two things go together), begin with "${opening}." and then answer briefly from general knowledge. Set inSource to false, leave ${cited} empty, and set generalKnowledge to true.
- When the ${noun} answers part of the question and general knowledge adds to it, give the ${noun}'s part first with its citations, then mark the rest with "Beyond the ${noun}, …", and set generalKnowledge to true.
- Never present general knowledge as something the ${noun} says. Say how settled it is: when the evidence is thin, mixed or disputed, say so rather than stating it as fact, and on health, medicine or safety keep to what is well established and say when it is worth asking a professional.
- When the question asks where or whether the ${noun} says something it doesn't, or has nothing to do with the ${noun}'s subject, say plainly that ${decline}, add nothing from general knowledge, leave ${cited} empty, and set generalKnowledge to false.
- Set generalKnowledge to false whenever the whole answer comes from the material.`;
}

// OV-342: left to guess, the model offered to read a photo of a label, and doubted that the
// overview's similar overviews were in the reader's own library.
function productBlock(kind: ChatSourceKind, material: string, verdict: boolean): string {
  const parts = !verdict
    ? ""
    : `
- Similar overviews in the reader's library, under the verdict, are other overviews the reader saved in The Overview. Speak of them as theirs.
- How to apply is fitted to the reader from what The Overview knows about them.`;
  return `# The Overview

You are the chat inside The Overview, the app where the reader saved this ${NOUN[kind]}.
- You have only the reader's typed messages, ${material}, and their other conversations about it when they are shown. You can't see images or files, open links, search the web, read more of their library than the other overviews shown here, or do anything outside this chat. Never offer to. When a question needs one of these, say what the reader can do instead, such as typing a label's figures into the chat.${parts}
- What The Overview knows about the reader comes from the About you sentence they write in onboarding or in Settings › Personalisation, and from what it notices in the overviews they save. They change it, and which sections an overview has, in Settings › Personalisation.`;
}

const NOUN: Record<ChatSourceKind, string> = { video: "video", episode: "episode", article: "article", recipe: "recipe page" };

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

Answer from the overview below. Answer from general knowledge only as the rules below allow.
- List as sources the ids (such as ${examples}) of the items the answer rests on. There is no transcript: always set inSource to false.
${judgement}- Never speak of the overview as a third party ("the overview suggests", "its judgement") and never in the first person. Give the answer itself. When the question is about a section, name it as the subject: ${kind === "recipe" ? '"Step 2 of the method…", "The ingredients list…"' : '"Read it anyway says…", "The chapter on costs…", "It\'s marked dubious because…"'}.
${beyondSourceRules({ noun, material: "the overview", decline, cited: "the sources" })} A question about what the full ${kind === "recipe" ? "page" : "article"} says gets that plain decline too: only the page could answer it.
- Cite only ids that appear in the overview. The premise, big picture, core claim and summary have no ids.

${ANSWER_SHAPE_RULES}

${productBlock(kind, "this overview", kind === "article")}

# The overview

${overview}`;
}

const transcriptBlocks = (passages: readonly Passage[]): string => passages.map(passageBlock).join("\n");

// After the transcript, so a new message in another chat leaves the transcript's cache whole,
// and as a user message: a second system message is folded into the first, and the transcript
// is then no longer the cached prefix a new conversation reads (OV-313's probe).
export function otherChatsPrompt(kind: ChatSourceKind, others: OtherChatsInPrompt): string | null {
  if (others.conversations.length === 0) {
    return null;
  }
  return `# The reader's other conversations about this ${kind}

Earlier conversations the reader had about the same ${kind}. Use them when the question refers to something the reader asked, decided or was told there, and list as sources the ids (such as c1.m3) of the messages you used. They are not the source: ${answeredFromOverviewAlone(kind) ? "anything about the " + kind + " must still cite the overview's items" : `anything about what the ${kind} says must still cite transcript passages`}, and an answer that rests only on these conversations has inSource false.

${others.conversations
  .map(
    (conversation) =>
      `## Conversation ${conversation.label}, started ${conversation.startedAt.slice(0, 10)}\n\n${conversation.lines.map((line) => `[${line.label} ${line.from}] ${line.text}`).join("\n")}`,
  )
  .join("\n\n")}`;
}
