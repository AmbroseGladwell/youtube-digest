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

async function playableResponse(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  client: InnerTubeClientConfig,
): Promise<PlayerResponse> {
  const response = await requestPlayerResponse(youTubeFetch, videoId, client);
  const failure = playabilityFailure(response.playabilityStatus?.status);
  if (failure !== null) {
    throw innerTubeError(
      response.playabilityStatus?.reason ?? `the video is not playable (${client.clientName})`,
      failure,
    );
  }
  return response;
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
// reason this replaces two billed calls with none. The two stages are kept apart so a
// failure fetching the captions is not reported as the next client's player failure —
// that masks the thing that actually went wrong.
export async function fetchInnerTubeTranscript(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  url: string,
  options: InnerTubeOptions = {},
): Promise<FetchedTranscript> {
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
      // Another client will not make a removed video exist.
      if (!isWorthAnotherSource(failed.failure)) throw failed;
      continue;
    }

    const track = selectCaptionTrack(captionTracksOf(response), {
      lang: options.lang,
      allowMachineTranscription: options.allowMachineTranscription ?? true,
    });
    // Another client will not find a track this one could not see.
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
      if (!isWorthAnotherSource(failed.failure)) throw failed;
    }
  }

  // A caption failure is the one that actually stopped us, and says more than a later
  // client being turned away at the player.
  throw (
    captionError ??
    playerError ??
    innerTubeError("no InnerTube client was configured", TranscriptFetchFailure.SOURCE_UNSUPPORTED)
  );
}
