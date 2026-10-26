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
  };
}
