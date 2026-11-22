import type { FetchedTranscript } from "../FetchedTranscript.js";
import type { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure, isWorthAnotherSource } from "../TranscriptFetchFailure.js";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import { fetchCaptionTrack } from "./fetchCaptionTrack.js";
import { DEFAULT_CAPTION_CLIENTS, DEFAULT_METADATA_CLIENT, type InnerTubeClientConfig } from "./InnerTubeClientConfig.js";
import { asInnerTubeError, innerTubeError, playabilityFailure } from "./innerTubeFailure.js";
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

const playableResponse = async (youTubeFetch: YouTubeFetch, videoId: string, client: InnerTubeClientConfig): Promise<PlayerResponse> => {
  const response = await requestPlayerResponse(youTubeFetch, videoId, client);
  const failure = playabilityFailure(response.playabilityStatus?.status);
  if (failure !== null) {
    throw innerTubeError(response.playabilityStatus?.reason ?? `the video is not playable (${client.clientName})`, failure);
  }
  return response;
};

// A second, best-effort call: a missing publish date is better than a guessed one.
const metadataResponse = async (
  youTubeFetch: YouTubeFetch,
  videoId: string,
  client: InnerTubeClientConfig | null,
): Promise<PlayerResponse | undefined> => {
  if (client === null) {
    return undefined;
  }
  return requestPlayerResponse(youTubeFetch, videoId, client).catch(() => undefined);
};

// Stages kept apart so a caption failure isn't reported as the next client's player failure.
export const fetchInnerTubeTranscript = async (
  youTubeFetch: YouTubeFetch,
  videoId: string,
  url: string,
  options: InnerTubeOptions = {},
): Promise<FetchedTranscript> => {
  const clients = options.clients ?? DEFAULT_CAPTION_CLIENTS;
  let playerError: TranscriptFetchError | null = null;
  let captionError: TranscriptFetchError | null = null;

  for (const client of clients) {
    let response: PlayerResponse;
    try {
      response = await playableResponse(youTubeFetch, videoId, client);
    } catch (error) {
      const failed = asInnerTubeError(error);
      playerError ??= failed;
      if (!isWorthAnotherSource(failed.failure)) {
        throw failed;
      }
      continue;
    }

    const track = selectCaptionTrack(captionTracksOf(response), {
      lang: options.lang,
      allowMachineTranscription: options.allowMachineTranscription ?? true,
    });
    if (track === null) {
      throw innerTubeError("this video has no captions", TranscriptFetchFailure.NO_CAPTIONS);
    }

    try {
      const segments = await fetchCaptionTrack(youTubeFetch, track, client);
      const metadata = await metadataResponse(
        youTubeFetch,
        videoId,
        options.metadataClient === undefined ? DEFAULT_METADATA_CLIENT : options.metadataClient,
      );
      return {
        video: mapPlayerResponseToVideoSource(response, url, metadata),
        transcript: segments,
        generated: isMachineTranscribed(track),
      };
    } catch (error) {
      const failed = asInnerTubeError(error);
      captionError ??= failed;
      if (!isWorthAnotherSource(failed.failure)) {
        throw failed;
      }
    }
  }

  // A caption failure is the one that actually stopped us.
  throw captionError ?? playerError ?? innerTubeError("no InnerTube client was configured", TranscriptFetchFailure.SOURCE_UNSUPPORTED);
};
