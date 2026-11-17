import { formatClock } from "@overview/domain";
import type { OtherChatsInPrompt } from "./otherChatsInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

export type ChatSourceKind = "video" | "episode";

const passageBlock = (passage: Passage): string => `[${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`;

// OV-267's fullTranscript shape, which cited the right moment on 46 of 48 questions and
// declined all 24 the source didn't answer, with the overview's items given ids so an answer
// can cite them too (OV-319). It is the first message and never changes within a
// conversation, so every follow-up reads it from the cache (docs/architecture/in-app-chat.md).
// The overview comes from overviewMarkdown with partIds.
export function chatSystemPrompt(kind: ChatSourceKind, overview: string, passages: readonly Passage[]): string {
  return `You answer a reader's questions about one ${kind} they saved in The Overview, and about the overview The Overview wrote of it.

Answer only from the material below: the overview and the transcript. Never answer from general knowledge, even when you know the answer. Answer in two to five plain sentences.
- When the transcript answers the question, set inSource to true and list in passages the ids (such as p12) of the transcript passages that support the answer.
- When the answer rests on an item of the overview, list its id (such as step2, dubious1 or apply1) in overviewParts. Items with ids are the verdict, why it is dubious, key points, the steps it gives, How to apply, what it sells, whether to watch it anyway, chapters, and a recipe's ingredients and method. When the transcript backs the same point, cite its passages as well.
- The verdict, why it is dubious, what it sells and whether to watch it anyway are the overview's own judgement of the ${kind}, not something the ${kind} says. Answer a question about them from the item, and cite the passage it refers to where the transcript has one.
- How to apply suggests what the reader might do, and may go beyond the ${kind}. When you answer from it, say that it is the overview's suggestion.
- inSource is about the transcript alone: set it to false when the transcript doesn't back the answer, even when the overview does.
- When neither the transcript nor the overview answers the question, set inSource to false, say plainly that the ${kind} doesn't cover it, and leave passages and overviewParts empty.
- Cite only ids that appear in the material. The premise, big picture and core claim have no ids: for those, cite the transcript.

# The overview

${overview}

# The transcript

${transcriptBlocks(passages)}`;
}

const transcriptBlocks = (passages: readonly Passage[]): string => passages.map(passageBlock).join("\n");

// After the transcript, so a new message in another chat leaves the transcript's cache whole,
// and as a user message: a second system message is folded into the first, and the transcript
// is then no longer the cached prefix a new conversation reads (OV-313's probe).
export function otherChatsPrompt(kind: ChatSourceKind, others: OtherChatsInPrompt): string | null {
  if (others.conversations.length === 0) return null;
  return `# The reader's other conversations about this ${kind}

Earlier conversations the reader had about the same ${kind}. Use them when the question refers to something the reader asked, decided or was told there, and list in chatMessages the ids (such as c1.m3) of the messages you used. They are not the source: anything about what the ${kind} says must still cite transcript passages, and an answer that rests only on these conversations has inSource false.

${others.conversations
  .map(
    (conversation) =>
      `## Conversation ${conversation.label}, started ${conversation.startedAt.slice(0, 10)}\n\n${conversation.lines.map((line) => `[${line.label} ${line.from}] ${line.text}`).join("\n")}`,
  )
  .join("\n\n")}`;
}
