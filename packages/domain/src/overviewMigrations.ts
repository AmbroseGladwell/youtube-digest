import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

const VIDEO_FIELDS_ADDED_AFTER_THE_FIRST_NOTES = ["durationMs", "publishedAt", "thumbnailUrl"];

// Their absence broke the page; null is what each already means (docs/features/record-migrations.md).
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

// Derivable; nothing shipped, so no deprecation window is built (docs/features/record-migrations.md).
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

// Not derivable: no record says where the subject changes (docs/features/chapters.md).
const fillChaptersAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 4,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "chapters" in record ? record : { ...record, chapters: null };
  },
};

// Novelty isn't derivable; key points keep their words, untimed (docs/features/novelty-scale.md).
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

// Not derivable: older notes never said why (docs/features/dubious-reasons.md).
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

// Derivable: everything before playlists was asked for on its own (docs/features/playlists.md).
const fillFromPlaylistAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 7,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "fromPlaylist" in record ? record : { ...record, fromPlaylist: null };
  },
};

// Additive: fewer than three tags, so older clients don't quarantine (docs/features/tag-reuse.md).
const allowFewerThanThreeTags: RecordMigration = { newSchemaVersion: 8 };

// Derivable as unknown: nothing recorded the key before ours existed (docs/architecture/tiers.md).
const fillMadeOnAddedWithOurKey: RecordMigration = {
  newSchemaVersion: 9,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "madeOn" in record ? record : { ...record, madeOn: null };
  },
};

// Exported: older clients still post this shape to POST /shares (docs/features/source-identity.md).
export const moveVideoToSource = (record: unknown): unknown => {
  if (typeof record !== "object" || record === null) {
    return record;
  }
  const { video, ...rest } = record as Record<string, unknown>;
  return typeof video === "object" && video !== null ? { ...rest, source: { ...video, kind: "youtube" } } : record;
};

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

// Recipes from videos: older clients hold these back rather than treat them as a page's.
const allowRecipesFromVideos: RecordMigration = { newSchemaVersion: 13 };

// In one line may run to 35 words, so older clients hold these back rather than quarantine them.
const allowLongerOneLiners: RecordMigration = { newSchemaVersion: 14 };

// Not derivable: docs/features/overview-generation-decisions.md, "The big picture".
const fillBigPictureAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 15,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "bigPicture" in record ? record : { ...record, bigPicture: null };
  },
};

// Ten key points exceed older clients' seven, so they hold these back rather than quarantine.
const allowTenKeyPoints: RecordMigration = { newSchemaVersion: 16 };

// Not derivable: older notes keep what they carried (docs/features/source-steps.md).
const fillSourceStepsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 17,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "sourceSteps" in record ? record : { ...record, sourceSteps: null };
  },
};

// Older clients would drop resources on write-back, so hold them back (docs/features/article-resources.md).
const allowArticleResources: RecordMigration = { newSchemaVersion: 18 };

// Not derivable: older notes show no questions (docs/features/follow-up-questions.md).
const fillFollowUpQuestionsAddedAfterTheFirstNotes: RecordMigration = {
  newSchemaVersion: 19,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return "followUpQuestions" in record ? record : { ...record, followUpQuestions: null };
  },
};

// Additive: an overview made from a followed feed names it (docs/features/followed-feeds.md).
const allowFeedOrigins: RecordMigration = { newSchemaVersion: 20 };

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
  allowArticleResources,
  fillFollowUpQuestionsAddedAfterTheFirstNotes,
  allowFeedOrigins,
];

export const CURRENT_OVERVIEW_SCHEMA_VERSION = currentSchemaVersion(OVERVIEW_MIGRATIONS);
