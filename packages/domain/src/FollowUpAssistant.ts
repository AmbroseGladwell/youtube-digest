import { z } from "zod";

export const FollowUpAssistant = z.enum(["claude", "chatgpt", "gemini"]);
export type FollowUpAssistant = z.infer<typeof FollowUpAssistant>;

// The assistant the reader says they use, in Settings › Connections (OV-301). "Other" connects
// by address alone, and questions to ask next don't open in it.
export const ChosenAssistant = z.enum([...FollowUpAssistant.options, "other"]);
export type ChosenAssistant = z.infer<typeof ChosenAssistant>;

export interface FollowUpAssistantLink {
  name: string;
  openUrl: string;
  // The query parameter that fills in its text box, or null when no link can: the prompt is
  // copied and the assistant opened for the reader to paste (docs/features/follow-up-questions.md).
  prefillParam: string | null;
}

// Tested by the owner on 14 November 2026: Claude and ChatGPT fill in from a link of up to
// about 51,000 characters, Claude under its own caution banner. Gemini opens but stays empty.
export const FOLLOW_UP_ASSISTANTS: Record<FollowUpAssistant, FollowUpAssistantLink> = {
  claude: { name: "Claude", openUrl: "https://claude.ai/new", prefillParam: "q" },
  chatgpt: { name: "ChatGPT", openUrl: "https://chatgpt.com/", prefillParam: "q" },
  gemini: { name: "Gemini", openUrl: "https://gemini.google.com/app", prefillParam: null },
};

// Which assistant a connection is, from the name its client registered with, which it chose
// itself. Null for any other client.
export function connectionAssistant(clientName: string | null): FollowUpAssistant | null {
  const name = clientName?.toLowerCase() ?? "";
  if (name.includes("claude")) {
    return "claude";
  }
  if (name.includes("chatgpt") || name.includes("openai")) {
    return "chatgpt";
  }
  if (name.includes("gemini")) {
    return "gemini";
  }
  return null;
}
