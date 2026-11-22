import type { TranscriptSegment } from "@overview/domain";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import type { InnerTubeClientConfig } from "./InnerTubeClientConfig.js";
import { httpFailure, innerTubeError } from "./innerTubeFailure.js";
import { mapJson3ToSegments } from "./mapJson3ToSegments.js";
import type { CaptionTrack } from "./PlayerResponse.js";

// baseUrl carries fmt=srv3, and a second fmt is ignored and returns XML, so it is replaced.
export const json3Url = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  return url.toString();
};

export const fetchCaptionTrack = async (
  youTubeFetch: YouTubeFetch,
  track: CaptionTrack,
  client: InnerTubeClientConfig,
): Promise<TranscriptSegment[]> => {
  const response = await youTubeFetch({
    url: json3Url(track.baseUrl),
    method: "GET",
    headers: { "User-Agent": client.userAgent },
  });

  if (response.status !== 200) {
    throw innerTubeError(`the caption track answered ${response.status}`, httpFailure(response.status));
  }
  return mapJson3ToSegments(response.body);
};
