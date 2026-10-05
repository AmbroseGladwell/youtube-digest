import { z } from "zod";
import { Novelty } from "@overview/domain";

export const LibraryFilters = z.object({
  query: z
    .string()
    .optional()
    .describe("Words to look for, all of which must appear: in the title, channel, claim, key points, verdict, selling or tags"),
  topic: z.string().optional().describe("A topic's name or id, as list_topics gives them"),
  tag: z.string().optional().describe("A tag, from the video's own tags or the reader's"),
  verdict: Novelty.optional()
    .describe(
      "How much of the video a well-read person in its field would already know, as judged by the AI that wrote the overview: common_knowledge, fresh_angle (one fresh part) or original. Not whether the reader has seen it before",
    ),
  dubious: z.boolean().optional().describe("true for only the videos whose claims were judged dubious"),
  favourite: z.boolean().optional().describe("true for only the reader's favourites"),
  read: z.boolean().optional().describe("true for only what the reader has read, false for only what they have not"),
  savedFrom: z.iso.date().optional().describe("Saved on or after this day, YYYY-MM-DD"),
  savedTo: z.iso.date().optional().describe("Saved on or before this day, YYYY-MM-DD"),
});
export type LibraryFilters = z.infer<typeof LibraryFilters>;
