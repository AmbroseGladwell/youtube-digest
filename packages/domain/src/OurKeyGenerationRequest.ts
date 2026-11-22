import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";
import { ExtractedArticle } from "./ExtractedArticle.js";
import { Tag } from "./Filing.js";
import { ModelId } from "./ModelId.js";
import { NoteKind } from "./NoteKind.js";
import { Overview } from "./Overview.js";
import { FilingProject } from "./Project.js";
import { Provider } from "./Provider.js";
import { SectionsEnabled } from "./Settings.js";
import { TagAliases } from "./TagAliases.js";
import { Topic } from "./Topic.js";
import { TranscriptSegment } from "./TranscriptSegment.js";
import { VideoSource } from "./VideoSource.js";
import { PodcastSource } from "./Source.js";

const readerContext = {
  captureReason: z.string().nullable(),
  readerContext: z.string().nullable(),
  sectionsEnabled: SectionsEnabled,
  existingTopics: z.array(Topic),
  // Empty from a client before filing into projects, and when the reader has switched it off.
  existingProjects: z.array(FilingProject).default([]),
  pastClaims: z.array(z.object({ overviewId: OverviewId, title: z.string(), claim: z.string() })),
  existingTags: z.array(z.object({ tag: Tag, count: z.number().int().min(1) })),
  tagAliases: TagAliases,
};

// The same input as the own-key path: docs/architecture/tiers.md, "Which key an overview uses".
export const OurKeyGenerationRequest = z.object({
  overviewId: OverviewId,
  // An episode first: read as a video it would lose the episode (docs/features/podcast-screens.md).
  input: z.union([
    z.object({ podcast: PodcastSource, video: VideoSource, transcript: z.array(TranscriptSegment).min(1), ...readerContext }),
    z.object({
      video: VideoSource,
      transcript: z.array(TranscriptSegment).min(1),
      // Checked before the account (OV-327), so writing doesn't check again.
      noteKind: NoteKind.optional(),
      ...readerContext,
    }),
    z.object({ article: ExtractedArticle, ...readerContext }),
  ]),
});
export type OurKeyGenerationRequest = z.infer<typeof OurKeyGenerationRequest>;

// Beside the overview, since an overview never lists its projects (docs/features/projects.md).
export const OurKeyGenerationResult = z.intersection(Overview, z.object({ filedProjectIds: z.array(ProjectId).default([]) }));
export type OurKeyGenerationResult = z.infer<typeof OurKeyGenerationResult>;

// Optional provider and model: a server deployed before OV-255 says only whether.
export const OurKeyGenerationStatus = z.object({
  available: z.boolean(),
  provider: Provider.optional(),
  model: ModelId.optional(),
});
export type OurKeyGenerationStatus = z.infer<typeof OurKeyGenerationStatus>;
