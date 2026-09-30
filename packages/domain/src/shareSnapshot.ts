import type { Overview } from "./Overview.js";
import type { SharedNarration, SharedOverview } from "./SharedOverview.js";
import type { SharedNote } from "./SharedNote.js";
import type { StoredTranscript } from "./StoredTranscript.js";

export interface ShareSnapshotInput {
  overview: Overview;
  transcript: StoredTranscript | null;
  narration: SharedNarration | null;
}

// The one place a shared copy is built. The server runs it over the overview the reader
// posted rather than trusting a snapshot the client assembled, so a private field cannot
// reach a share by any route (docs/features/sharing.md).
export function shareSnapshot({ overview, transcript, narration }: ShareSnapshotInput): SharedOverview {
  const note: SharedNote = {
    id: overview.id,
    video: overview.video,
    savedAt: overview.savedAt,
    inOneLine: overview.inOneLine,
    coreClaim: overview.coreClaim,
    thin: overview.thin,
    keyPoints: overview.keyPoints,
    // Similar overviews are the reader's other notes: their titles are not the visitor's to
    // read, and the ids would be dead links off a page with no library behind it.
    verdict: overview.verdict === null ? null : { ...overview.verdict, similarTo: [] },
    selling: overview.selling,
    howToApply: overview.howToApply,
    watchAnyway: overview.watchAnyway,
    chapters: overview.chapters,
  };
  return { note, transcript, narration };
}
