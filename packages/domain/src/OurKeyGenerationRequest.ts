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

// What a device sends to have an overview made on our key: the same input it would give its
// own key's model, with the transcript it already resolved or the article it read, so the
// prompt is production's either way (docs/architecture/tiers.md, "Which key an overview uses").
export const OurKeyGenerationRequest = z.object({
  overviewId: OverviewId,
  // An episode first: it carries the video's fields too, and read as a video it would lose the
  // episode it is (docs/features/podcast-screens.md).
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

// The overview, with the projects it was filed into beside it rather than on it, since an
// overview never lists its projects (docs/features/projects.md). A client from before reads the
// overview and drops the rest; a server from before sends none.
export const OurKeyGenerationResult = z.intersection(Overview, z.object({ filedProjectIds: z.array(ProjectId).default([]) }));
export type OurKeyGenerationResult = z.infer<typeof OurKeyGenerationResult>;

// Whether this server makes overviews on our key at all, asked before it is offered, and
// with which provider and model, so the app's analytics can name them (OV-255). Optional
// because a server deployed before it says only whether.
export const OurKeyGenerationStatus = z.object({
  available: z.boolean(),
  provider: Provider.optional(),
  model: ModelId.optional(),
});
export type OurKeyGenerationStatus = z.infer<typeof OurKeyGenerationStatus>;
