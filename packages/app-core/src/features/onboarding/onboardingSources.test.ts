import { describe, expect, it, vi } from "vitest";
import { Source, VideoId, type ArticleRead, type PodcastEpisode, type StoredTranscript, type VideoSource } from "@overview/domain";
import { makeArticleOverview, makeOverview } from "../overviews/types/OverviewFactory.testHelper.js";
import { foundIn, onboardingSourceOf, onboardingSources, type OnboardingMakers } from "./onboardingSources.js";
import type { TranscriptionProgress } from "../podcasts/api/transcribeEpisode.js";

const kindsOfSource = Source.options.map((option) => option.shape.kind.value);

describe("onboardingSources", () => {
  it("has an entry for every kind of source, so a new kind can't ship without its onboarding", () => {
    expect(Object.keys(onboardingSources).sort()).toEqual([...kindsOfSource].sort());
  });

  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs", "playlist", null],
    ["https://theharbourpost.example/2026/11/bridge-bill-twice", "article", null],
  ])("takes %s as a %s", (link, linkKind, key) => {
    const recognised = onboardingSourceOf(link);
    expect(recognised?.linkKind).toBe(linkKind);
    expect(recognised?.source.keyFromLink(link)).toBe(key);
  });

  it.each(["", "not a link", "ftp://files.example/report", "https://www.youtube.com/playlist?list=WL"])("refuses %j", (link) => {
    expect(onboardingSourceOf(link)).toBeNull();
  });

  it("makes a video from its key, and an article from the link itself", () => {
    const link = "https://theharbourpost.example/2026/11/bridge-bill-twice";
    expect(onboardingSources.youtube.target({ link, sourceKey: null })).toBeNull();
    expect(onboardingSources.youtube.target({ link, sourceKey: "dQw4w9WgXcQ" })).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(onboardingSources.web.target({ link, sourceKey: null })).toBe(link);
  });

  const RECIPE = { prepMinutes: 15, cookMinutes: 50, totalMinutes: 65, yield: "4" };

  it("names what was found, so the confirm screen asks about the right thing", () => {
    const article = foundIn(makeArticleOverview());
    expect(onboardingSources.youtube.noun("playlist", null)).toBe("playlist");
    expect(onboardingSources.youtube.noun("video", foundIn(makeOverview()))).toBe("video");
    expect(onboardingSources.web.noun("article", null)).toBe("page");
    expect(onboardingSources.web.noun("article", article)).toBe("article");
    expect(onboardingSources.web.noun("article", { ...article, recipe: RECIPE })).toBe("recipe");
  });

  it("gives each kind's card the facts 327s draws", () => {
    const article = makeArticleOverview();
    const video = makeOverview();
    expect(onboardingSources.web.card(foundIn(article))).toEqual({
      kicker: expect.stringMatching(/ · Article$/),
      facts: { line: expect.stringMatching(/^\d+ min read · /) },
    });
    expect(onboardingSources.web.card({ ...foundIn(article), recipe: RECIPE }).facts.line).toMatch(/^1 hr 5 min · Serves 4 · /);
    expect(onboardingSources.youtube.card(foundIn(video)).kicker).toMatch(/ · Video$/);
    expect(onboardingSources.youtube.card({ ...foundIn(video), noteKind: "recipe" }).kicker).toMatch(/ · Recipe video$/);
    expect(onboardingSources.youtube.card(foundIn(video)).facts.line).toMatch(/YouTube$/);
  });

  it("says on Your link what they'll get, with the minutes it's given and none it isn't", () => {
    const video = { ...foundIn(makeOverview()), source: { ...makeOverview().source, durationMs: 38 * 60_000 } as Source };
    const words = onboardingSources.youtube.yourLink(video, { read: 4, listen: 6 });
    expect(words.heading).toBe("Here’s what’s in the video you saved.");
    expect(words.line).toMatch(/^38 minutes from .+, turned into an overview you can read in about 4, listen to in about 6, and share\.$/);
    expect(words.pills).toBe("readListen");
    expect(onboardingSources.youtube.yourLink(video, null).line).toMatch(/turned into an overview you can read, listen to and share\.$/);
    expect(onboardingSources.youtube.yourLink({ ...video, noteKind: "recipe" }, null)).toMatchObject({
      heading: "Here’s the recipe you saved.",
      pills: "cook",
    });
    expect(onboardingSources.web.yourLink({ ...foundIn(makeArticleOverview()), recipe: RECIPE }, null).pills).toBe("cook");
    expect(onboardingSources.web.yourLink(foundIn(makeArticleOverview()), null).inside).toMatch(/the things it links to\.$/);
  });
  it("transcribes the episode it read, and passes on how the transcribing is going", async () => {
    const link = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";
    const episode = { feedUrl: "https://feeds.example/diary.xml", guid: "episode-guid", title: "Ageing" } as PodcastEpisode;
    const asked: { transcribe: unknown; episode: PodcastEpisode }[] = [];
    const told: TranscriptionProgress[] = [];
    const makers = {
      readPodcast: async () => ({ status: "read", episode }),
      podcast: async (request, options) => {
        asked.push({ transcribe: request.transcribe, episode: request.episode });
        options.onTranscription?.("starting");
        options.onTranscription?.("transcribing");
        return makeOverview();
      },
    } as Pick<OnboardingMakers, "readPodcast" | "podcast"> as OnboardingMakers;

    await onboardingSources.podcast.make(link, makers, {
      transcribe: "asked",
      onFound: () => {},
      onTranscription: (progress) => told.push(progress),
      isCancelled: () => false,
      waitToSpend: async () => {},
    });

    expect(asked).toEqual([{ transcribe: "asked", episode }]);
    expect(told).toEqual(["starting", "transcribing"]);
  });
});

describe("onboarding's run, before and after the account", () => {
  const VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const video: VideoSource = {
    id: VideoId.parse("dQw4w9WgXcQ"),
    url: VIDEO_URL,
    title: "Knife Skills in Ten Minutes",
    channel: "Kitchen Basics",
    description: "A chef shows the claw grip.",
    durationMs: 725_000,
    publishedAt: null,
    thumbnailUrl: null,
  };
  const transcript: StoredTranscript = {
    videoId: VideoId.parse("dQw4w9WgXcQ"),
    segments: [{ text: "Curl your fingers in.", startMs: 0, endMs: 2000 }],
    generated: false,
    fetchedAt: "2026-11-20T09:00:00.000Z",
  };
  const account = () => {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => (open = resolve));
    return { open, waitToSpend: () => opened };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("reads a video and shows it, keeps the transcript the read came with and writes with its kind only once there's an account", async () => {
    const order: string[] = [];
    const kept: StoredTranscript[] = [];
    const written: unknown[] = [];
    const makers = {
      readVideo: async () => {
        order.push("read");
        return { status: "read", video, noteKind: "recipe", transcript };
      },
      keepTranscript: async (stored) => {
        order.push("kept");
        kept.push(stored);
      },
      video: async (_url, options) => {
        order.push("written");
        written.push(options.noteKind);
        return makeOverview();
      },
    } as Pick<OnboardingMakers, "readVideo" | "keepTranscript" | "video"> as OnboardingMakers;
    const { open, waitToSpend } = account();
    const found: string[] = [];

    const run = onboardingSources.youtube.make(VIDEO_URL, makers, {
      onFound: (it) => found.push(`${it.source.title} | ${it.about}`),
      isCancelled: () => false,
      waitToSpend,
    });
    await settle();

    expect(order).toEqual(["read"]);
    expect(found).toEqual(["Knife Skills in Ten Minutes | A chef shows the claw grip.\n\nCurl your fingers in."]);
    open();
    await run;
    expect(order).toEqual(["read", "kept", "written"]);
    expect(kept[0]).toMatchObject({ videoId: "dQw4w9WgXcQ", video: { title: "Knife Skills in Ten Minutes" } });
    expect(written).toEqual(["recipe"]);
  });

  it("stops at a video it couldn't read, having spent nothing", async () => {
    const makers = {
      readVideo: async () => ({ status: "failed", reason: "not-found" }),
      video: async () => {
        throw new Error("never written");
      },
    } as Pick<OnboardingMakers, "readVideo" | "video"> as OnboardingMakers;

    await expect(
      onboardingSources.youtube.make(VIDEO_URL, makers, { onFound: () => {}, isCancelled: () => false, waitToSpend: async () => {} }),
    ).rejects.toMatchObject({ reason: "not-found" });
  });

  it("reads a page and shows it, and hands the same read to writing once there's an account", async () => {
    const article = makeArticleOverview();
    const read = {
      status: "read",
      article: {
        url: "https://theharbourpost.example/2026/11/bridge-bill-twice",
        title: article.source.title,
        siteName: "The Harbour Post",
        author: null,
        publishedAt: null,
        language: "en",
        imageUrl: null,
        wordCount: 1200,
        sections: [{ heading: null, text: "The county reused an old survey." }],
        links: [],
        recipe: null,
      },
    } as unknown as ArticleRead;
    let reads = 0;
    const written: ArticleRead[] = [];
    const makers = {
      readArticle: async () => {
        reads += 1;
        return read;
      },
      article: async (readAgain) => {
        written.push(await readAgain());
        return article;
      },
    } as Pick<OnboardingMakers, "readArticle" | "article"> as OnboardingMakers;
    const { open, waitToSpend } = account();
    let shown = false;

    const run = onboardingSources.web.make(read.status === "read" ? read.article.url : "", makers, {
      onFound: () => (shown = true),
      isCancelled: () => false,
      waitToSpend,
    });
    await settle();

    expect(shown).toBe(true);
    expect(written).toEqual([]);
    open();
    await run;
    expect(written).toEqual([read]);
    expect(reads).toBe(1);
  });

  it("reads an episode and shows it, and looks for its words only once there's an account", async () => {
    const episode = { feedUrl: "https://feeds.example/diary.xml", guid: "episode-guid", title: "Ageing", notes: "" } as PodcastEpisode;
    const order: string[] = [];
    const makers = {
      readPodcast: async () => {
        order.push("read");
        return { status: "read", episode };
      },
      podcast: async () => {
        order.push("words and writing");
        return makeOverview();
      },
    } as Pick<OnboardingMakers, "readPodcast" | "podcast"> as OnboardingMakers;
    const { open, waitToSpend } = account();

    const run = onboardingSources.podcast.make("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk", makers, {
      onFound: () => order.push("shown"),
      isCancelled: () => false,
      waitToSpend,
    });
    await vi.waitFor(() => expect(order).toEqual(["read", "shown"]));
    await settle();
    expect(order).toEqual(["read", "shown"]);
    open();
    await run;
    expect(order).toEqual(["read", "shown", "words and writing"]);
  });
});
