import { z } from "zod";

// Room for a project's name and what it's for, which suggest what might fit it (OV-318).
export const MEANING_QUERY_MAX_LENGTH = 400;

// Closest first. The reader's own word matches come from the device, which drops any of
// these it already shows (docs/features/search-by-meaning.md, "The route").
export const MeaningSearchResponse = z.discriminatedUnion("available", [
  z.object({
    available: z.literal(true),
    matches: z.array(z.object({ overviewId: z.string(), similarity: z.number() })),
  }),
  z.object({ available: z.literal(false) }),
]);
export type MeaningSearchResponse = z.infer<typeof MeaningSearchResponse>;
