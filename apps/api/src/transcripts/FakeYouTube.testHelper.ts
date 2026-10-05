import type { PlayerResponse, YouTubeFetch, YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/transcripts";
import { JSON3_WRITTEN, makeMetadataResponse, makePlayerResponse } from "@overview/transcripts/testing";
import type { ServiceFetches } from "./fetchThroughService.js";

export type YouTubeAnswer = "captions" | "bot-check" | "no-captions" | "removed";

export interface FakeYouTubeRequest {
  route: "direct" | "proxy";
  session: string | null;
  url: string;
  videoId: string | null;
}

export interface FakeYouTube {
  fetches: ServiceFetches;
  requests: FakeYouTubeRequest[];
  // What YouTube says to each route, which a test can change between calls.
  answers: { direct: YouTubeAnswer; proxy: YouTubeAnswer };
  sessionsClosed: number;
}

const ok = (body: unknown): YouTubeFetchResponse => ({
  status: 200,
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const playerFor = (videoId: string, answer: YouTubeAnswer): PlayerResponse => {
  const base = makePlayerResponse();
  const videoDetails = { ...base.videoDetails!, videoId };
  if (answer === "bot-check") {
    return { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" } };
  }
  if (answer === "removed") return { playabilityStatus: { status: "ERROR", reason: "This video has been removed" } };
  if (answer === "no-captions") return { ...base, videoDetails, captions: { playerCaptionsTracklistRenderer: { captionTracks: [] } } };
  return { ...base, videoDetails };
};

// YouTube as our server sees it, from our own address and through the proxy, answering
// each route as the test says (docs/conventions/backend-testing-guide.md).
export function makeFakeYouTube(answers: FakeYouTube["answers"] = { direct: "captions", proxy: "captions" }): FakeYouTube {
  const fake: FakeYouTube = { fetches: undefined!, requests: [], answers, sessionsClosed: 0 };
  let sessions = 0;

  const route =
    (name: FakeYouTubeRequest["route"], session: string | null): YouTubeFetch =>
    (request: YouTubeFetchRequest) => {
      const videoId =
        request.body === undefined ? null : ((JSON.parse(request.body) as { videoId?: string }).videoId ?? null);
      fake.requests.push({ route: name, session, url: request.url, videoId });
      if (request.url.includes("timedtext")) return Promise.resolve(ok(JSON3_WRITTEN));
      if (request.headers["X-YouTube-Client-Name"] === "WEB") return Promise.resolve(ok(makeMetadataResponse()));
      return Promise.resolve(ok(playerFor(videoId ?? "", fake.answers[name])));
    };

  fake.fetches = {
    direct: route("direct", null),
    proxied: (session) => ({
      youTubeFetch: route("proxy", session),
      close: () => {
        fake.sessionsClosed += 1;
        return Promise.resolve();
      },
    }),
    newSession: () => `session-${(sessions += 1)}`,
  };
  return fake;
}
