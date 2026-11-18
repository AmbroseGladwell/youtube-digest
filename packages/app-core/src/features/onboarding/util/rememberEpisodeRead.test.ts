import type { PodcastEpisode, PodcastRead } from "@overview/domain";
import { describe, expect, it, vi } from "vitest";
import { rememberEpisodeRead } from "./rememberEpisodeRead.js";

const LINK = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";
const read: PodcastRead = { status: "read", episode: { title: "Why your parents’ decline is a preview" } as PodcastEpisode };
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("rememberEpisodeRead", () => {
  it("reads an episode once, however often the run asks for it", async () => {
    const reads = new Map<string, Promise<PodcastRead>>();
    const fetch = vi.fn(async () => read);

    expect(await rememberEpisodeRead(reads, LINK, fetch)).toBe(read);
    expect(await rememberEpisodeRead(reads, LINK, fetch)).toBe(read);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks again after a read that failed or never answered", async () => {
    const reads = new Map<string, Promise<PodcastRead>>();
    const failed: PodcastRead = { status: "failed", reason: "no-answer" };
    const fetch = vi
      .fn<(link: string) => Promise<PodcastRead>>()
      .mockResolvedValueOnce(failed)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(read);

    expect(await rememberEpisodeRead(reads, LINK, fetch)).toBe(failed);
    await settled();
    await expect(rememberEpisodeRead(reads, LINK, fetch)).rejects.toThrow("offline");
    await settled();
    expect(await rememberEpisodeRead(reads, LINK, fetch)).toBe(read);

    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps each link's read apart", async () => {
    const reads = new Map<string, Promise<PodcastRead>>();
    const fetch = vi.fn(async () => read);

    await rememberEpisodeRead(reads, LINK, fetch);
    await rememberEpisodeRead(reads, "https://podcasts.apple.com/gb/podcast/x/id1?i=2", fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
