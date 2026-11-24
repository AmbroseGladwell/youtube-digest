import { describe, expect, it } from "vitest";
import { SourceKey, type Source } from "@overview/domain";
import { librarySourceOf } from "./librarySourceOf.js";

const web = (url: string, siteName: string | null = null): Source => ({
  kind: "web",
  id: SourceKey.parse("article1"),
  url,
  title: "A page",
  siteName,
  author: null,
  publishedAt: null,
  language: null,
  imageUrl: null,
  wordCount: 500,
});

const podcast = (sharedFrom: string): Source => ({
  kind: "podcast",
  id: SourceKey.parse("episode1"),
  feedUrl: "https://feeds.example.com/show.xml",
  guid: "guid-1",
  title: "An episode",
  showName: "The Show",
  publishedAt: null,
  durationMs: null,
  audioUrl: "https://cdn.example.com/1.mp3",
  pageUrl: null,
  imageUrl: null,
  sharedFrom,
});

describe("librarySourceOf", () => {
  it("names a website by its site name, keyed by the registrable domain so www. and m. fold together", () => {
    expect(librarySourceOf(web("https://www.seriouseats.com/pizza", "Serious Eats"))).toEqual({
      id: "site:seriouseats.com",
      name: "Serious Eats",
      domain: "seriouseats.com",
      platform: "website",
    });
    expect(librarySourceOf(web("https://m.seriouseats.com/pasta")).id).toBe("site:seriouseats.com");
    expect(librarySourceOf(web("https://news.bbc.co.uk/story")).id).toBe("site:bbc.co.uk");
  });

  it("names a website with no site name by its domain", () => {
    expect(librarySourceOf(web("https://blog.example.org/post")).name).toBe("example.org");
  });

  it("names a podcast by where it was shared from, never its feed", () => {
    expect(librarySourceOf(podcast("https://open.spotify.com/episode/abc")).id).toBe("spotify");
    expect(librarySourceOf(podcast("https://podcasts.apple.com/gb/podcast/x/id1")).id).toBe("applePodcasts");
    expect(librarySourceOf(podcast("https://www.theshow.fm/episodes/1"))).toMatchObject({ id: "site:theshow.fm", platform: "website" });
  });

  it("names a podcast found through YouTube as YouTube", () => {
    expect(librarySourceOf(podcast("https://youtu.be/abc")).id).toBe("youtube");
  });

  it("names the platforms by their source kind, a written post included", () => {
    expect(
      librarySourceOf({
        kind: "instagram",
        id: SourceKey.parse("post1"),
        url: "https://www.instagram.com/p/abc",
        title: "A post",
        handle: null,
        authorName: "Someone",
        media: "photo",
        wordCount: 80,
        durationMs: null,
        publishedAt: null,
        imageUrl: null,
      }),
    ).toMatchObject({ id: "instagram", name: "Instagram", platform: "instagram" });
  });
});
