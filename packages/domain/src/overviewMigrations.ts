import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

const VIDEO_FIELDS_ADDED_AFTER_THE_FIRST_NOTES = ["durationMs", "publishedAt", "thumbnailUrl"];

// The three fields whose absence produced a missing image, a NaN:NaN duration and a
// RangeError that took the page down. Null is what the schema already says each of them
// means for a note generated before the field existed
// (docs/features/record-migrations.md).
const fillVideoFieldsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { video } = record as { video?: unknown };
    if (typeof video !== "object" || video === null) {
      return record;
    }
    const filled: Record<string, unknown> = { ...(video as Record<string, unknown>) };
    for (const field of VIDEO_FIELDS_ADDED_AFTER_THE_FIRST_NOTES) {
      if (!(field in filled)) {
        filled[field] = null;
      }
    }
    return { ...record, video: filled };
  },
};

// A rename is derivable: the record already holds the value, under the other key
// (docs/features/record-migrations.md). Nothing has shipped and no client but this one
// writes, so the deprecation window that a rename would otherwise need — write both names,
// raise the write floor, then drop one — is not needed and is not built.
const renameSavedNoteToCaptureReason: RecordMigration = {
  newSchemaVersion: 3,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { savedNote, ...rest } = record as Record<string, unknown>;
    return { ...rest, captureReason: savedNote ?? null };
  },
};

// Not derivable: nothing in an older record says where its video's subject changes, so
// the honest value is the one the reader is told about (docs/features/chapters.md).
const fillChaptersAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 4,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "chapters" in record ? record : { ...record, chapters: null };
  },
};

// The novelty half is not derivable: the old scale's middle bucket splits across the new
// one, and only the developer's own overviews were ever written on it. The key points half
// is: each keeps its words and has no stretch of the video yet
// (docs/features/novelty-scale.md).
const moveToTheNewScaleAndTimedKeyPoints: RecordMigration = {
  newSchemaVersion: 5,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { verdict, keyPoints } = record as { verdict?: unknown; keyPoints?: unknown };
    return {
      ...record,
      ...(Array.isArray(keyPoints) ? { keyPoints: keyPoints.map((text) => ({ text, range: null })) } : {}),
      ...(typeof verdict === "object" && verdict !== null ? { verdict: { ...verdict, novelty: "common_knowledge", standsOut: null } } : {}),
    };
  },
};

// Not derivable either: an older note says it is dubious but never said why, and the reader
// is told no reason was saved rather than shown an empty panel (docs/features/dubious-reasons.md).
const fillDubiousClaimsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 6,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { verdict } = record as { verdict?: unknown };
    if (typeof verdict !== "object" || verdict === null || "dubiousClaims" in verdict) {
      return record;
    }
    return { ...record, verdict: { ...verdict, dubiousClaims: null } };
  },
};

// Derivable: every overview made before playlists could be followed was asked for on its
// own (docs/features/playlists.md).
const fillFromPlaylistAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 7,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "fromPlaylist" in record ? record : { ...record, fromPlaylist: null };
  },
};

// Additive: a note may now hold fewer than three tags, after the reader merges or deletes
// them. Moving the number keeps an older client from quarantining one (docs/features/tag-reuse.md).
const allowFewerThanThreeTags: RecordMigration = { newSchemaVersion: 8 };

// Derivable as unknown: nothing recorded which key made an overview before our key existed,
// and only a fallback is ever shown (docs/architecture/tiers.md).
const fillMadeOnAddedWithOurKey: RecordMigration = {
  newSchemaVersion: 9,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "madeOn" in record ? record : { ...record, madeOn: null };
  },
};

// A rename, derivable because every overview so far is of a YouTube video. Exported because a
// client at an older version still posts this shape to POST /shares, which takes the overview
// itself rather than a record (docs/features/source-identity.md).
export function moveVideoToSource(record: unknown): unknown {
  if (typeof record !== "object" || record === null) {
    return record;
  }
  const { video, ...rest } = record as Record<string, unknown>;
  return typeof video === "object" && video !== null ? { ...rest, source: { ...video, kind: "youtube" } } : record;
}

// Derivable: everything before articles is a video (docs/features/article-notes.md).
const fillArticleAddedWithArticles: RecordMigration = {
  newSchemaVersion: 11,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "article" in record ? record : { ...record, article: null };
  },
};

// Derivable: everything before recipes is a video or an article (docs/features/recipe-notes.md).
const fillRecipeAddedWithRecipes: RecordMigration = {
  newSchemaVersion: 12,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "recipe" in record ? record : { ...record, recipe: null };
  },
};

// Nothing to alter: a recipe can now come from a video, whose steps carry their moment, so older
// clients hold these records back rather than show a recipe they would treat as a page's.
const allowRecipesFromVideos: RecordMigration = { newSchemaVersion: 13 };

// Nothing to alter: In one line may now run to 35 words, past the 25 an older client refuses,
// so older clients hold these records back rather than quarantine them.
const allowLongerOneLiners: RecordMigration = { newSchemaVersion: 14 };

// Not derivable: an older note has no ground written for it, and it opens on its premise as
// it always did (docs/features/overview-generation-decisions.md, "The big picture").
const fillBigPictureAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 15,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "bigPicture" in record ? record : { ...record, bigPicture: null };
  },
};

// Nothing to alter: a long source's note may now hold ten key points, past the seven an older
// client refuses, so older clients hold these records back rather than quarantine them.
const allowTenKeyPoints: RecordMigration = { newSchemaVersion: 16 };

// Not derivable: an older note has no steps written for it, and keeps what it always carried
// (docs/features/source-steps.md).
const fillSourceStepsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 17,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "sourceSteps" in record ? record : { ...record, sourceSteps: null };
  },
};

export const OVERVIEW_MIGRATIONS: readonly RecordMigration[] = [
  fillVideoFieldsAddedAfterTheFirstNotes,
  renameSavedNoteToCaptureReason,
  fillChaptersAddedAfterTheFirstNotes,
  moveToTheNewScaleAndTimedKeyPoints,
  fillDubiousClaimsAddedAfterTheFirstNotes,
  fillFromPlaylistAddedAfterTheFirstNotes,
  allowFewerThanThreeTags,
  fillMadeOnAddedWithOurKey,
  { newSchemaVersion: 10, alterRecord: moveVideoToSource },
  fillArticleAddedWithArticles,
  fillRecipeAddedWithRecipes,
  allowRecipesFromVideos,
  allowLongerOneLiners,
  fillBigPictureAddedAfterTheFirstNotes,
  allowTenKeyPoints,
  fillSourceStepsAddedAfterTheFirstNotes,
];

export const CURRENT_OVERVIEW_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_MIGRATIONS);
