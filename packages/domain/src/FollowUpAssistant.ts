import { z } from "zod";

export const FollowUpAssistant = z.enum(["claude", "chatgpt", "gemini"]);
export type FollowUpAssistant = z.infer<typeof FollowUpAssistant>;

// "Other" connects by address alone, and questions to ask next don't open in it (OV-301).
export const ChosenAssistant = z.enum([...FollowUpAssistant.options, "other"]);
export type ChosenAssistant = z.infer<typeof ChosenAssistant>;

export interface FollowUpAssistantLink {
  name: string;
  openUrl: string;
  // Null when no link can: the prompt is copied for pasting (docs/features/follow-up-questions.md).
  prefillParam: string | null;
}

// Owner-tested 14 Nov 2026: Claude and ChatGPT prefill up to ~51,000 characters; Gemini stays empty.
export const FOLLOW_UP_ASSISTANTS: Record<FollowUpAssistant, FollowUpAssistantLink> = {
  claude: { name: "Claude", openUrl: "https://claude.ai/new", prefillParam: "q" },
  chatgpt: { name: "ChatGPT", openUrl: "https://chatgpt.com/", prefillParam: "q" },
  gemini: { name: "Gemini", openUrl: "https://gemini.google.com/app", prefillParam: null },
};

// From the name the client registered itself with; null for any other client.
export const connectionAssistant = (clientName: string | null): FollowUpAssistant | null => {
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
};
