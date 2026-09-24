const OVERVIEW_ID = "9f1c2e7a-5d3b-4f8e-9a1b-2c3d4e5f6a7b";
const TOPIC_ID = "3b7d4c21-8e6f-4a52-9c0d-1e2f3a4b5c6d";
const SIMILAR_OVERVIEW_ID = "c4a9f0d2-7b31-4e68-8f5a-0d1c2b3a4e5f";

const version1 = {
  id: OVERVIEW_ID,
  video: {
    id: "kQu7vN2wLpE",
    url: "https://www.youtube.com/watch?v=kQu7vN2wLpE",
    title: "The only kettlebell swing tutorial you need",
    channel: "Strength Practice",
    description: "A long walk through the hinge, the float, and the three faults that cause most back pain.",
  },
  savedAt: "2026-01-04T09:30:00.000Z",
  savedNote: "Watch again before the next session.",
  inOneLine: "A careful breakdown of the hip hinge behind a heavy kettlebell swing.",
  coreClaim:
    "The swing is a hinge rather than a squat, and the float at the top is produced by the hips snapping shut rather than by the arms lifting the bell.",
  thin: false,
  keyPoints: [
    "The bell is thrown backwards between the legs, not lowered in front of them.",
    "The top of the swing is a standing plank held for a fraction of a second.",
    "Most back pain in the swing comes from squatting it rather than hinging it.",
  ],
  topicIds: [TOPIC_ID],
  tags: ["kettlebell", "hip-hinge", "technique"],
  verdict: {
    novelty: "novel",
    dubious: true,
    reasoning:
      "The hinge cueing is genuinely better than the usual version, but the claim about spinal decompression is asserted rather than sourced.",
    similarTo: [{ overviewId: SIMILAR_OVERVIEW_ID, title: "Hinge before you load" }],
  },
  selling: {
    type: "own_paid_product",
    detail: "A paid programme is pitched twice, once mid-video and once at the end.",
    compromisesContent: false,
  },
  howToApply: {
    items: [
      "Film one set from the side before changing anything.",
      "Drop the weight until the float happens without pulling.",
    ],
  },
  watchAnyway: {
    answer: "partial",
    reason: "The fault-finding section is worth seeing in motion; the rest is in this note.",
    range: { startMs: 412000, endMs: 658000 },
  },
};

const version2 = {
  ...version1,
  video: {
    ...version1.video,
    durationMs: null,
    publishedAt: null,
    thumbnailUrl: null,
  },
  schemaVersion: 2,
};

const { savedNote: _renamedToCaptureReason, ...version2WithoutTheOldKey } = version2;

const version3 = {
  ...version2WithoutTheOldKey,
  captureReason: version2.savedNote,
  schemaVersion: 3,
};

// One curated record per version, exercising every field at that version — which an
// arbitrary real record does not guarantee, and which is why these are written rather
// than harvested from a dev profile (docs/features/record-migrations.md).
export const OVERVIEW_CORPUS: ReadonlyMap<number, unknown> = new Map<number, unknown>([
  [1, version1],
  [2, version2],
  [3, version3],
]);
