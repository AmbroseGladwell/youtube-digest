import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { Tag } from "./Filing.js";
import { SectionsEnabled } from "./Settings.js";
import { TagAliases } from "./TagAliases.js";
import { Topic } from "./Topic.js";
import { TranscriptSegment } from "./TranscriptSegment.js";
import { VideoSource } from "./VideoSource.js";

// What a device sends to have an overview made on our key: the same input it would give its
// own key's model, with the transcript it already resolved, so the prompt is production's
// either way (docs/architecture/tiers.md, "Which key an overview uses").
export const OurKeyGenerationRequest = z.object({
  overviewId: OverviewId,
  input: z.object({
    video: VideoSource,
    transcript: z.array(TranscriptSegment).min(1),
    captureReason: z.string().nullable(),
    readerContext: z.string().nullable(),
    sectionsEnabled: SectionsEnabled,
    existingTopics: z.array(Topic),
    pastClaims: z.array(z.object({ overviewId: OverviewId, title: z.string(), claim: z.string() })),
    existingTags: z.array(z.object({ tag: Tag, count: z.number().int().min(1) })),
    tagAliases: TagAliases,
  }),
});
export type OurKeyGenerationRequest = z.infer<typeof OurKeyGenerationRequest>;

// Whether this server makes overviews on our key at all, asked before it is offered.
export const OurKeyGenerationStatus = z.object({ available: z.boolean() });
export type OurKeyGenerationStatus = z.infer<typeof OurKeyGenerationStatus>;
