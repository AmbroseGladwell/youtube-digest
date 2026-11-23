import test from "node:test";
import assert from "node:assert/strict";
import type { SocialRead } from "@overview/domain";
import { createFetchSocialApi } from "./fetchSocialApi.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ method: string | undefined; url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ method: init?.method, url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const read: SocialRead = {
  status: "read",
  post: {
    platform: "instagram",
    id: "DAbCdEfGh12",
    url: "https://www.instagram.com/reel/DAbCdEfGh12/",
    handle: "windowsillgarden",
    authorName: "Windowsill Garden",
    description: "Five ways to keep basil alive",
    media: "video",
    durationSeconds: 59,
    coverUrl: null,
    postedAt: null,
  },
  transcript: null,
  transcription: { status: "needed", episodeSeconds: 59, usage: { usedSeconds: 0, limitSeconds: 18_000, episodes: 0 } },
};

test("an Instagram or Facebook link is read in one call, and a failed read comes back as the failure", async () => {
  const { sent, fetch } = answering(200, read);
  const api = createFetchSocialApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });
  assert.deepEqual(await api.read("https://www.instagram.com/reel/DAbCdEfGh12/"), read);
  assert.deepEqual(sent, [
    { method: "POST", url: "https://overview.example/api/social/read", body: { url: "https://www.instagram.com/reel/DAbCdEfGh12/" } },
  ]);

  const failed = answering(200, { status: "failed", reason: "unavailable" });
  assert.deepEqual(await createFetchSocialApi({ baseUrl: "https://overview.example", fetch: failed.fetch }).read("x"), {
    status: "failed",
    reason: "unavailable",
  });
});

test("transcribing posts the link, and its progress is asked for by id", async () => {
  const { sent, fetch } = answering(200, { id: "t-1", status: "queued" });
  const api = createFetchSocialApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });
  await api.transcribe("https://www.facebook.com/reel/1535600000000001").catch(() => null);
  await api.transcription("t-1").catch(() => null);
  assert.deepEqual(
    sent.map(({ method, url }) => `${method} ${url}`),
    ["POST https://overview.example/api/social/transcription", "GET https://overview.example/api/social/transcription/t-1"],
  );
});
