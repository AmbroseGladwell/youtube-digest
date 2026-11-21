import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";

export const MAX_CHAT_QUESTION_LENGTH = 2_000;
export const MAX_CHAT_PINS = 20;

// A reader's question to POST /api/chats/:overviewId/messages: a new conversation is a new
// uuid, a follow-up repeats its conversation's. pins are what the reader added with "@" for
// this question, and setAside the other overviews they took out of the conversation
// (docs/features/chats.md, "Other overviews").
export const ChatQuestionRequest = z.object({
  conversationId: z.uuid(),
  text: z.string().trim().min(1).max(MAX_CHAT_QUESTION_LENGTH),
  pins: z
    .object({
      overviews: z.array(OverviewId).max(MAX_CHAT_PINS).default([]),
      projects: z.array(ProjectId).max(MAX_CHAT_PINS).default([]),
    })
    .default({ overviews: [], projects: [] }),
  setAside: z.array(OverviewId).max(MAX_CHAT_PINS).default([]),
  // Search my library (OV-354): off, only what the reader pinned is read.
  searchLibrary: z.boolean().default(true),
});
export type ChatQuestionRequest = z.infer<typeof ChatQuestionRequest>;
export type ChatQuestionInput = z.input<typeof ChatQuestionRequest>;
