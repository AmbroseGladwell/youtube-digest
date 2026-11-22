import { randomUUID } from "node:crypto";
import type { LightMyRequestResponse } from "fastify";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_TOKEN_HEADER } from "@overview/domain";
import { generationRequest } from "../generation/FakeOpenAi.testHelper.js";
import type { TestApp } from "./createTestApp.testHelper.js";

export const TRIAL_ADDRESS = "203.0.113.7";

export interface TrialDevice {
  token: string;
  generate(overviewId?: string): Promise<LightMyRequestResponse>;
  fetchTranscript(videoId: string): Promise<LightMyRequestResponse>;
  readArticle(url: string): Promise<LightMyRequestResponse>;
  readVideo(videoId: string): Promise<LightMyRequestResponse>;
  readPodcast(url: string): Promise<LightMyRequestResponse>;
  readTikTok(url: string): Promise<LightMyRequestResponse>;
  tiktokTranscript(videoId: string): Promise<LightMyRequestResponse>;
  podcastTranscript(episode: { feedUrl: string; guid: string }): Promise<LightMyRequestResponse>;
  transcribe(episode: { feedUrl: string; guid: string }): Promise<LightMyRequestResponse>;
  transcription(id: string): Promise<LightMyRequestResponse>;
  checkTranscript(episode: { feedUrl: string; guid: string }): Promise<LightMyRequestResponse>;
  suggestTopics(title?: string): Promise<LightMyRequestResponse>;
}

// A signed-out device holding the trial token the server issued it, asking from one address.
export async function makeTrialDevice({ app }: TestApp, address = TRIAL_ADDRESS): Promise<TrialDevice> {
  const versioned = { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
  const issued = await app.inject({ method: "POST", url: "/api/trials", headers: versioned, remoteAddress: address });
  if (issued.statusCode !== 200) throw new Error(`trials answered ${issued.statusCode}: ${issued.body}`);
  const token: string = issued.json().token;
  const headers = { ...versioned, [TRIAL_TOKEN_HEADER]: token };
  return {
    token,
    generate: (overviewId = randomUUID()) =>
      app.inject({ method: "POST", url: "/api/generations", headers, payload: generationRequest(overviewId), remoteAddress: address }),
    fetchTranscript: (videoId) =>
      app.inject({ method: "POST", url: `/api/service-transcripts/${videoId}`, headers, remoteAddress: address }),
    readArticle: (url) => app.inject({ method: "POST", url: "/api/articles/read", headers, payload: { url }, remoteAddress: address }),
    readVideo: (videoId) => app.inject({ method: "POST", url: "/api/videos/read", headers, payload: { videoId }, remoteAddress: address }),
    readPodcast: (url) => app.inject({ method: "POST", url: "/api/podcasts/read", headers, payload: { url }, remoteAddress: address }),
    readTikTok: (url) => app.inject({ method: "POST", url: "/api/tiktok/read", headers, payload: { url }, remoteAddress: address }),
    tiktokTranscript: (videoId) =>
      app.inject({ method: "POST", url: "/api/tiktok/transcript", headers, payload: { videoId }, remoteAddress: address }),
    podcastTranscript: (episode) =>
      app.inject({ method: "POST", url: "/api/podcasts/transcript", headers, payload: episode, remoteAddress: address }),
    transcribe: (episode) =>
      app.inject({ method: "POST", url: "/api/podcasts/transcription", headers, payload: episode, remoteAddress: address }),
    transcription: (id) => app.inject({ method: "GET", url: `/api/podcasts/transcription/${id}`, headers, remoteAddress: address }),
    checkTranscript: (episode) =>
      app.inject({ method: "POST", url: "/api/podcasts/transcript/check", headers, payload: episode, remoteAddress: address }),
    suggestTopics: (title = "Knife Skills in Ten Minutes") =>
      app.inject({
        method: "POST",
        url: "/api/generations/topic-suggestions",
        headers,
        payload: { title, kind: "video", text: "A chef shows the claw grip." },
        remoteAddress: address,
      }),
  };
}
