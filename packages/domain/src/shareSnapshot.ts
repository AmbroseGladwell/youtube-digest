import type { Overview } from "./Overview.js";
import type { SharedNarration, SharedOverview } from "./SharedOverview.js";
import type { SharedNote } from "./SharedNote.js";

export interface ShareSnapshotInput {
  overview: Overview;
  narration: SharedNarration | null;
}

// The one place a shared copy is built. The server runs it over the overview the reader
// posted rather than trusting a snapshot the client assembled, so a private field cannot
// reach a share by any route (docs/features/sharing.md). A shared copy never carries the
// transcript: the source's words are each reader's own, not ours to publish on a link (OV-295).
export function shareSnapshot({ overview, narration }: ShareSnapshotInput): SharedOverview {
  const note: SharedNote = {
    id: overview.id,
    source: overview.source,
    savedAt: overview.savedAt,
    inOneLine: overview.inOneLine,
    coreClaim: overview.coreClaim,
    thin: overview.thin,
    keyPoints: overview.keyPoints,
    tags: overview.tags,
    // Similar overviews are the reader's other notes: their titles are not the visitor's to
    // read, and the ids would be dead links off a page with no library behind it.
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
}
