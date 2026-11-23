import { describe, expect, it } from "vitest";
import { CAPTIONS_URL, CAPTIONS_VTT, VIDEO_ID, makeTikTokItem, makeTikTokPage, pageWithItem } from "@overview/transcripts/testing";
import { readTikTokInBrowser } from "./chromeTikTokPages.js";

const NOW = new Date("2026-11-22T10:00:00.000Z");
const LINK = `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}?is_from_webapp=1`;

const answering = (pages: Record<string, Response | Error>) => {
  const asked: { url: string; credentials: RequestCredentials | undefined }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, credentials: init?.credentials });
    const answer = pages[url];
    if (answer === undefined) {
      return new Response("", { status: 404 });
    }
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  }) as typeof fetch;
  return { fetcher, asked };
};

const page = (html = makeTikTokPage()) => new Response(html, { status: 200 });
const PAGE_ADDRESS = `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}`;

describe("readTikTokInBrowser", () => {
  it("reads the page and its spoken captions as a signed-out visitor, keyed as a TikTok", async () => {
    const { fetcher, asked } = answering({ [PAGE_ADDRESS]: page(), [CAPTIONS_URL]: new Response(CAPTIONS_VTT) });

    const read = await readTikTokInBrowser(LINK, fetcher, () => NOW);

    expect(read.status).toBe("read");
    expect(asked).toEqual([
      { url: PAGE_ADDRESS, credentials: "omit" },
      { url: CAPTIONS_URL, credentials: "omit" },
    ]);
    if (read.status !== "read") {
      return;
    }
    expect(read.video.handle).toBe("anewsroom");
    expect(read.transcript?.videoId).toBe(`tiktok:${VIDEO_ID}`);
    expect(read.transcript?.generated).toBe(true);
    expect(read.transcript?.fetchedAt).toBe(NOW.toISOString());
    expect(read.transcript?.segments.map(({ text }) => text).join(" ")).toMatch(/^There is now a real chance/);
  });

  it("reads a video with no captions, or whose captions won't load, with no words", async () => {
    const bare = answering({ [PAGE_ADDRESS]: page(pageWithItem(makeTikTokItem({}, { subtitleInfos: [] }))) });
    const broken = answering({ [PAGE_ADDRESS]: page(), [CAPTIONS_URL]: new Error("network") });

    expect(await readTikTokInBrowser(LINK, bare.fetcher)).toMatchObject({ status: "read", transcript: null });
    expect(await readTikTokInBrowser(LINK, broken.fetcher)).toMatchObject({ status: "read", transcript: null });
  });

  it("asks for a link with no handle by the video's own address, and a short link as it came", async () => {
    const { fetcher, asked } = answering({});

    await readTikTokInBrowser(`https://www.tiktok.com/embed/v2/${VIDEO_ID}`, fetcher);
    await readTikTokInBrowser("https://vm.tiktok.com/ZMhAbCdEf/", fetcher);

    expect(asked.map(({ url }) => url)).toEqual([`https://www.tiktok.com/@/video/${VIDEO_ID}`, "https://vm.tiktok.com/ZMhAbCdEf/"]);
  });

  it("names why a page couldn't be read, without fetching anything for a link that isn't a video", async () => {
    const { fetcher, asked } = answering({});

    expect(await readTikTokInBrowser("https://www.tiktok.com/@anewsroom", fetcher)).toEqual({ status: "failed", reason: "not-a-video" });
    expect(asked).toEqual([]);
    expect(await readTikTokInBrowser(LINK, fetcher)).toEqual({ status: "failed", reason: "unavailable" });
    expect(await readTikTokInBrowser(LINK, answering({ [PAGE_ADDRESS]: new Response("", { status: 403 }) }).fetcher)).toEqual({
      status: "failed",
      reason: "blocked",
    });
    expect(await readTikTokInBrowser(LINK, answering({ [PAGE_ADDRESS]: new Error("offline") }).fetcher)).toEqual({
      status: "failed",
      reason: "no-answer",
    });
    expect(await readTikTokInBrowser(LINK, answering({ [PAGE_ADDRESS]: page("<html></html>") }).fetcher)).toEqual({
      status: "failed",
      reason: "unreadable",
    });
  });
});
