import { z } from "zod";

export const CaptionTrack = z.object({
  baseUrl: z.string().min(1),
  languageCode: z.string().optional(),
  // Present and "asr" only on a machine-heard track. This is the whole of what decides
  // StoredTranscript.generated (docs/features/transcript-retrieval.md).
  kind: z.string().nullish(),
  vssId: z.string().optional(),
});

export type CaptionTrack = z.infer<typeof CaptionTrack>;

// Only the fields that are read. Modelling the whole payload would make every unrelated
// change upstream look like drift.
export const PlayerResponse = z.object({
  playabilityStatus: z
    .object({ status: z.string().optional(), reason: z.string().optional() })
    .optional(),
  videoDetails: z
    .object({
      videoId: z.string().optional(),
      title: z.string().optional(),
      author: z.string().optional(),
      shortDescription: z.string().optional(),
      // A string, and "0" for anything live.
      lengthSeconds: z.string().optional(),
      isLiveContent: z.boolean().optional(),
      thumbnail: z
        .object({
          thumbnails: z.array(
            z.object({ url: z.string(), width: z.number(), height: z.number() }),
          ),
        })
        .optional(),
    })
    .optional(),
  captions: z
    .object({
      playerCaptionsTracklistRenderer: z
        .object({ captionTracks: z.array(CaptionTrack).optional() })
        .optional(),
    })
    .optional(),
  microformat: z
    .object({
      playerMicroformatRenderer: z
        .object({ publishDate: z.string().optional(), uploadDate: z.string().optional() })
        .optional(),
    })
    .optional(),
});

export type PlayerResponse = z.infer<typeof PlayerResponse>;

export const captionTracksOf = (response: PlayerResponse): CaptionTrack[] =>
  response.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
