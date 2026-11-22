import { describe, expect, it } from "vitest";
import type { StoredTranscript, TikTokRead, TikTokVideo } from "@overview/domain";
import type { OwnTikTokRead, TikTokPages } from "../../../app/TikTokPagesContext.js";
import { readTikTokLink } from "./readTikTokLink.js";

const LINK = "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456";

const video: TikTokVideo = {
  id: "7301234567890123456",
  url: LINK,
  handle: "kitchenwithada",
  authorName: "Kitchen with Ada",
  description: "Sunday jollof",
  durationSeconds: 42,
  coverUrl: null,
  postedAt: null,
  captions: [{ language: "eng-US", source: "ASR" }],
};

const transcript: StoredTranscript = {
  videoId: "tiktok:7301234567890123456" as StoredTranscript["videoId"],
  segments: [{ text: "Fry the base.", startMs: 0, endMs: 1500 }],
  generated: true,
  fetchedAt: "2026-11-22T09:00:00.000Z",
};

const ownReading = (answer: OwnTikTokRead | Error, access = true) => {
  const asked: string[] = [];
  const own: TikTokPages = {
    hasAccess: async () => access,
    requestAccess: async () => access,
    read: async (link) => {
      asked.push(link);
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    },
  };
  return { own, asked };
};

const serverAnswering = (answer: TikTokRead) => {
  const asked: string[] = [];
  return {
    asked,
    server: async (link: string) => {
      asked.push(link);
      return answer;
    },
  };
};

const VENDOR_READ: TikTokRead = { status: "read", video, transcript };

describe("readTikTokLink", () => {
  it("takes the words from the reader's own browser when it finds them, and never asks the vendor", async () => {
    const { own } = ownReading({ status: "read", video, transcript });
    const { server, asked } = serverAnswering(VENDOR_READ);

    expect(await readTikTokLink(LINK, { own, server })).toEqual({ status: "read", video, words: { transcript, source: "tiktok-tab" } });
    expect(asked).toEqual([]);
  });

  it.each<[string, OwnTikTokRead | Error]>([
    ["has no captions", { status: "read", video, transcript: null }],
    ["can't read the page", { status: "failed", reason: "unreadable" }],
    ["is refused", { status: "failed", reason: "blocked" }],
    ["finds nothing there", { status: "failed", reason: "unavailable" }],
    ["throws", new Error("network")],
  ])("asks the vendor when the own read %s", async (_, answer) => {
    const { own } = ownReading(answer);
    const { server, asked } = serverAnswering(VENDOR_READ);

    expect(await readTikTokLink(LINK, { own, server })).toEqual({ status: "read", video, words: { transcript, source: "tiktok-vendor" } });
    expect(asked).toEqual([LINK]);
  });

  it("believes the page when it says the post isn't a video, and spends nothing at the vendor", async () => {
    const { own } = ownReading({ status: "failed", reason: "not-a-video" });
    const { server, asked } = serverAnswering(VENDOR_READ);

    expect(await readTikTokLink(LINK, { own, server })).toEqual({ status: "failed", reason: "not-a-video" });
    expect(asked).toEqual([]);
  });

  it("goes straight to the vendor without access to TikTok, or on the web with no own read", async () => {
    const withoutAccess = ownReading({ status: "read", video, transcript }, false);
    const { server, asked } = serverAnswering(VENDOR_READ);

    await readTikTokLink(LINK, { own: withoutAccess.own, server });
    await readTikTokLink(LINK, { own: null, server });

    expect(withoutAccess.asked).toEqual([]);
    expect(asked).toEqual([LINK, LINK]);
  });

  it("passes on the vendor's failure, and a video it found with no captions has no words", async () => {
    expect(await readTikTokLink(LINK, { own: null, server: serverAnswering({ status: "failed", reason: "blocked" }).server })).toEqual({
      status: "failed",
      reason: "blocked",
    });
    expect(await readTikTokLink(LINK, { own: null, server: serverAnswering({ status: "read", video, transcript: null }).server })).toEqual({
      status: "read",
      video,
      words: null,
    });
  });
});
