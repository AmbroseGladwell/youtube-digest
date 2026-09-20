import type { TranscriptSegment } from "@overview/types";
import type { FetchedTranscript } from "../FetchedTranscript.js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure, isWorthAnotherSource } from "../TranscriptFetchFailure.js";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import { fetchCaptionTrack } from "./fetchCaptionTrack.js";
import {
  DEFAULT_CAPTION_CLIENTS,
  DEFAULT_METADATA_CLIENT,
  type InnerTubeClientConfig,
} from "./InnerTubeClientConfig.js";
import { innerTubeError, playabilityFailure } from "./innerTubeFailure.js";
import { mapPlayerResponseToVideoSource } from "./mapPlayerResponseToVideoSource.js";
import { captionTracksOf, type PlayerResponse } from "./PlayerResponse.js";
import { requestPlayerResponse } from "./requestPlayerResponse.js";
import { isMachineTranscribed, selectCaptionTrack } from "./selectCaptionTrack.js";

export interface InnerTubeOptions {
  lang?: string | undefined;
  allowMachineTranscription?: boolean;
  clients?: readonly InnerTubeClientConfig[];
  metadataClient?: InnerTubeClientConfig | null;
}

async function captionsWithClient(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  client: InnerTubeClientConfig,
  options: InnerTubeOptions,
): Promise<{ response: PlayerResponse; segments: TranscriptSegment[]; generated: boolean }> {
  const response = await requestPlayerResponse(youTubeFetch, videoId, client);

  const failure = playabilityFailure(response.playabilityStatus?.status);
  if (failure !== null) {
    throw innerTubeError(
      response.playabilityStatus?.reason ?? `the video is not playable (${client.clientName})`,
      failure,
    );
  }

  const track = selectCaptionTrack(captionTracksOf(response), {
    lang: options.lang,
    allowMachineTranscription: options.allowMachineTranscription ?? true,
  });
  if (track === null) {
    throw innerTubeError("this video has no captions", TranscriptFetchFailure.NO_CAPTIONS);
  }

  const segments = await fetchCaptionTrack(youTubeFetch, track, client);
  return { response, segments, generated: isMachineTranscribed(track) };
}

// publishDate lives on a client that carries no caption tracks, so it is a second call and
// a best-effort one: VideoSource.publishedAt is nullable and a missing date is better than
// a guessed one (docs/features/transcript-retrieval.md).
async function metadataResponse(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  client: InnerTubeClientConfig | null,
): Promise<PlayerResponse | undefined> {
  if (client === null) return undefined;
  return requestPlayerResponse(youTubeFetch, videoId, client).catch(() => undefined);
}

// One player call serves the metadata and the caption tracks together, which is the whole
// reason this replaces two billed calls with none.
export async function fetchInnerTubeTranscript(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  url: string,
  options: InnerTubeOptions = {},
): Promise<FetchedTranscript> {
  const clients = options.clients ?? DEFAULT_CAPTION_CLIENTS;
  let lastError: TranscriptFetchError | null = null;

  for (const client of clients) {
    try {
      const { response, segments, generated } = await captionsWithClient(
        youTubeFetch,
        videoId,
        client,
        options,
      );
      const metadata = await metadataResponse(
        youTubeFetch,
        videoId,
        options.metadataClient === undefined ? DEFAULT_METADATA_CLIENT : options.metadataClient,
      );
      return { video: mapPlayerResponseToVideoSource(response, url, metadata), transcript: segments, generated };
    } catch (error) {
      const failed =
        error instanceof TranscriptFetchError
          ? error
          : innerTubeError("the player request failed", TranscriptFetchFailure.SOURCE_UNAVAILABLE, error);
      lastError = failed;
      // Another client will not find captions this one could not see, and will not make
      // a removed video exist.
      if (!isWorthAnotherSource(failed.failure) || failed.failure === TranscriptFetchFailure.NO_CAPTIONS) {
        throw failed;
      }
    }
  }

  throw lastError ?? innerTubeError("no InnerTube client was configured", TranscriptFetchFailure.SOURCE_UNSUPPORTED);
}
