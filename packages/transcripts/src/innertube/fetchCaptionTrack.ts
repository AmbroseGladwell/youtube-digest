import type { TranscriptSegment } from "@overview/domain";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import type { InnerTubeClientConfig } from "./InnerTubeClientConfig.js";
import { httpFailure, innerTubeError } from "./innerTubeFailure.js";
import { mapJson3ToSegments } from "./mapJson3ToSegments.js";
import type { CaptionTrack } from "./PlayerResponse.js";

// baseUrl already carries fmt=srv3. Appending another fmt is ignored and XML comes back,
// so the parameter is replaced (docs/features/transcript-retrieval.md).
export function json3Url(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  return url.toString();
}

export async function fetchCaptionTrack(
  youTubeFetch: YouTubeFetch,
  track: CaptionTrack,
  client: InnerTubeClientConfig,
): Promise<TranscriptSegment[]> {
  const response = await youTubeFetch({
    url: json3Url(track.baseUrl),
    method: "GET",
    headers: { "User-Agent": client.userAgent },
  });

  if (response.status !== 200) {
    throw innerTubeError(
      `the caption track answered ${response.status}`,
      httpFailure(response.status),
    );
  }
  return mapJson3ToSegments(response.body);
}
