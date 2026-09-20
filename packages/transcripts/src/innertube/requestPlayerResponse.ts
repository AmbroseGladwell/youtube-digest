import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import type { InnerTubeClientConfig } from "./InnerTubeClientConfig.js";
import { httpFailure, innerTubeError } from "./innerTubeFailure.js";
import { PlayerResponse } from "./PlayerResponse.js";

const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player";

export async function requestPlayerResponse(
  youTubeFetch: YouTubeFetch,
  videoId: string,
  client: InnerTubeClientConfig,
): Promise<PlayerResponse> {
  const response = await youTubeFetch({
    url: PLAYER_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
      "X-YouTube-Client-Name": client.clientName,
      "X-YouTube-Client-Version": client.clientVersion,
    },
    body: JSON.stringify({
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      context: {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          hl: "en",
          gl: "US",
          ...client.extraContext,
        },
      },
    }),
  });

  if (response.status !== 200) {
    throw innerTubeError(
      `the player endpoint answered ${response.status} for ${client.clientName}`,
      httpFailure(response.status),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    throw innerTubeError(
      `the player endpoint answered ${client.clientName} with something that was not JSON`,
      TranscriptFetchFailure.MALFORMED_RESPONSE,
      error,
    );
  }

  const result = PlayerResponse.safeParse(parsed);
  if (!result.success) {
    throw innerTubeError(
      `the player response did not have the shape ${client.clientName} is expected to return`,
      TranscriptFetchFailure.MALFORMED_RESPONSE,
      result.error,
    );
  }
  return result.data;
}
