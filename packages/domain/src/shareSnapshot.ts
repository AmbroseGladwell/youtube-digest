import type { Overview } from "./Overview.js";
import type { SharedNarration, SharedOverview } from "./SharedOverview.js";
import type { SharedNote } from "./SharedNote.js";

export interface ShareSnapshotInput {
  overview: Overview;
  narration: SharedNarration | null;
}

// Built by the server, so no private field or transcript reaches a share (docs/features/sharing.md).
export const shareSnapshot = ({ overview, narration }: ShareSnapshotInput): SharedOverview => {
  const note: SharedNote = {
    id: overview.id,
    source: overview.source,
    savedAt: overview.savedAt,
    inOneLine: overview.inOneLine,
    coreClaim: overview.coreClaim,
    thin: overview.thin,
    keyPoints: overview.keyPoints,
    tags: overview.tags,
    // The reader's other notes aren't the visitor's to read, and would be dead links here.
    verdict: overview.verdict === null ? null : { ...overview.verdict, similarTo: [] },
    selling: overview.selling,
    howToApply: overview.howToApply,
    watchAnyway: overview.watchAnyway,
    chapters: overview.chapters,
    ...(overview.bigPicture === null ? {} : { bigPicture: overview.bigPicture }),
    ...(overview.sourceSteps === null ? {} : { sourceSteps: overview.sourceSteps }),
    ...(overview.article === null ? {} : { article: overview.article }),
    ...(overview.recipe === null ? {} : { recipe: overview.recipe }),
  };
  return { note, transcript: null, narration };
};
