import {
  fetchSupadataCaptions,
  fetchSupadataVideoSource,
  type SupadataClient,
} from "@overview/transcripts";
import type { TranscriptSource } from "../types/TranscriptSource.js";

// The probe between the two calls lives here rather than in the ladder, because it exists
// only for a source that bills the halves separately. A source that returns both in one
// call has no gap to ask a question in (docs/features/transcript-storage.md).
export const supadataTranscriptSource = (client: SupadataClient): TranscriptSource => ({
  tier: "supadata",
  cost: "metered",
  isReady: () => Promise.resolve(true),
  resolve: async (url, context) => {
    const video = await fetchSupadataVideoSource(client, url);
    const held = video.id === null ? null : await context.readHeldTranscript(video.id);
    if (held) {
      return { video, transcript: held.segments, generated: held.generated };
    }
    const fetched = await fetchSupadataCaptions(client, url);
    return { video, transcript: fetched.transcript, generated: fetched.generated };
  },
});
