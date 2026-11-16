import { formatClock } from "@overview/domain";
import type { OtherChatsInPrompt } from "./otherChatsInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

export type ChatSourceKind = "video" | "episode";

const passageBlock = (passage: Passage): string => `[${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`;

// OV-267's fullTranscript shape, which cited the right moment on 46 of 48 questions and
// declined all 24 the source didn't answer, with the overview added for context. It is the
// first message and never changes within a conversation, so every follow-up reads it from
// the cache (docs/architecture/in-app-chat.md).
export function chatSystemPrompt(kind: ChatSourceKind, overview: string, passages: readonly Passage[]): string {
  return `You answer a reader's questions about one ${kind} they saved in The Overview.

Answer only from the material below. Never answer from general knowledge, even when you know the answer.
- When the transcript answers the question, set inSource to true, answer in two to five plain sentences, and list in passages the ids (such as p12) of the transcript passages that support the answer.
- When the transcript does not say, set inSource to false, say plainly that the ${kind} doesn't cover it, and leave passages empty.
- Cite only passage ids that appear in the material.
- The overview is a summary of the whole ${kind}, for context. Cite passages, never the overview.

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
