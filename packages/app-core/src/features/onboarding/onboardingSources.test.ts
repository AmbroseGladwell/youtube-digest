import { describe, expect, it, vi } from "vitest";
import {
  Source,
  VideoId,
  type ArticleRead,
  type PodcastEpisode,
  type StoredTranscript,
  type TikTokVideo,
  type TranscriptCheck,
  type VideoSource,
} from "@overview/domain";
import { makeArticleOverview, makeOverview, makeTikTokOverview } from "../overviews/types/OverviewFactory.testHelper.js";
import { TikTokNoCaptionsError, TikTokReadError } from "../newOverview/api/TikTokReadError.js";
import type { TikTokWords } from "../newOverview/api/generationPipeline.js";
import { foundIn, onboardingSourceOf, onboardingSources, type OnboardingMakers } from "./onboardingSources.js";
import type { TranscriptionProgress } from "../podcasts/api/transcribeEpisode.js";
import { EpisodeNeedsTranscribingError } from "../podcasts/api/EpisodeNeedsTranscribingError.js";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { EpisodeCannotBeMadeError } from "./EpisodeCannotBeMadeError.js";

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
      checkEpisode: async () => ({ words: "found" }),
      podcast: async (request, options) => {
        asked.push({ transcribe: request.transcribe, episode: request.episode });
        options.onTranscription?.("starting");
        options.onTranscription?.("transcribing");
        return makeOverview();
      },
    } as Pick<OnboardingMakers, "readPodcast" | "checkEpisode" | "podcast"> as OnboardingMakers;

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
    await vi.waitFor(() => expect(shown).toBe(true));
    await settle();
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
      checkEpisode: async () => {
        order.push("checked");
        return { words: "found" };
      },
      podcast: async () => {
        order.push("words and writing");
        return makeOverview();
      },
    } as Pick<OnboardingMakers, "readPodcast" | "checkEpisode" | "podcast"> as OnboardingMakers;
    const { open, waitToSpend } = account();

    const run = onboardingSources.podcast.make("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk", makers, {
      onFound: () => order.push("shown"),
      isCancelled: () => false,
      waitToSpend,
    });
    await vi.waitFor(() => expect(order).toEqual(["read", "checked", "shown"]));
    await settle();
    expect(order).toEqual(["read", "checked", "shown"]);
    open();
    await run;
    expect(order).toEqual(["read", "checked", "shown", "words and writing"]);
  });

  describe("an episode's words, checked as it's read (327v–327w-4)", () => {
    const LINK = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";
    const episode = {
      feedUrl: "https://feeds.example/diary.xml",
      guid: "episode-guid",
      title: "Ageing",
      notes: "",
      durationSeconds: 4320,
    } as PodcastEpisode;
    const usage = { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 };
    const noWords = () =>
      new EpisodeNeedsTranscribingError(new TranscriptFetchError("none", { failure: TranscriptFetchFailure.NO_CAPTIONS }));
    const runWith = (
      check: () => Promise<TranscriptCheck>,
      written: (transcribe: unknown) => void,
      firstTry: "words" | "none" = "words",
    ) => {
      const shown: { episodeWords?: TranscriptCheck | null }[] = [];
      let waited = false;
      const makers = {
        readPodcast: async () => ({ status: "read", episode }),
        checkEpisode: check,
        podcast: async (request) => {
          written(request.transcribe);
          if (firstTry === "none" && request.transcribe === undefined) {
            throw noWords();
          }
          return makeOverview();
        },
      } as Pick<OnboardingMakers, "readPodcast" | "checkEpisode" | "podcast"> as OnboardingMakers;
      const run = onboardingSources.podcast.make(LINK, makers, {
        onFound: (found) => shown.push(found),
        isCancelled: () => false,
        waitToSpend: async () => {
          waited = true;
        },
      });
      return { run, shown, waited: () => waited };
    };

    it("with no transcript, Looks right was the consent, so the wait transcribes without asking", async () => {
      const asked: unknown[] = [];
      const { run, shown } = runWith(
        async () => ({ words: "none", transcription: { status: "needed", episodeSeconds: 4320, usage } }),
        (transcribe) => asked.push(transcribe),
      );
      await run;
      expect(shown[0]?.episodeWords?.words).toBe("none");
      expect(asked).toEqual(["chosen"]);
    });

    it("looks for the words first where the check found them, and transcribes if they turn out missing", async () => {
      const asked: unknown[] = [];
      const { run } = runWith(
        async () => ({ words: "found" }),
        (transcribe) => asked.push(transcribe),
        "none",
      );
      await run;
      expect(asked).toEqual([undefined, "chosen"]);
    });

    it("takes a check that couldn't be asked as unknown, and looks for the words", async () => {
      const asked: unknown[] = [];
      const { run, shown } = runWith(
        async () => {
          throw new Error("offline");
        },
        (transcribe) => asked.push(transcribe),
      );
      await run;
      expect(shown[0]?.episodeWords).toEqual({ words: "unknown" });
      expect(asked).toEqual([undefined]);
    });

    it("stops at an episode it can't transcribe, having shown it and spent nothing", async () => {
      const asked: unknown[] = [];
      const { run, shown, waited } = runWith(
        async () => ({ words: "none", transcription: { status: "too-long", episodeSeconds: 5 * 3600 } }),
        (transcribe) => asked.push(transcribe),
      );
      await expect(run).rejects.toBeInstanceOf(EpisodeCannotBeMadeError);
      expect(shown).toHaveLength(1);
      expect(waited()).toBe(false);
      expect(asked).toEqual([]);
    });

    it("says on Your link what will happen, or why it can't be made", () => {
      const found = (episodeWords: TranscriptCheck) => ({
        ...foundIn(makeOverview()),
        source: { kind: "podcast", durationMs: 4_320_000, sharedFrom: LINK, title: "Ageing", show: "Diary", publishedAt: null } as never,
        episodeWords,
      });
      const needed = onboardingSources.podcast.yourLink(
        found({ words: "none", transcription: { status: "needed", episodeSeconds: 4320, usage } }),
        null,
      );
      const noAudio = onboardingSources.podcast.yourLink(found({ words: "none", transcription: { status: "no-audio" } }), null);
      const withWords = onboardingSources.podcast.yourLink(found({ words: "found" }), null);

      expect(needed.notice).toBe(
        "There’s no transcript, so we’ll make one from the audio: about 1 hr 12 min of your 5 free hours this month.",
      );
      expect(noAudio.heading).toBe("We found the episode, but can’t make this one.");
      expect(noAudio.stop).toMatch(/^This episode’s audio isn’t in the public feed/);
      expect(withWords.notice ?? null).toBeNull();
      expect(withWords.stop ?? null).toBeNull();
    });
  });

  describe("a TikTok", () => {
    const TIKTOK = "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456";
    const clip: TikTokVideo = {
      id: "7301234567890123456",
      url: TIKTOK,
      handle: "kitchenwithada",
      authorName: "Kitchen with Ada",
      description: "Sunday jollof #jollof",
      durationSeconds: 42,
      coverUrl: null,
      postedAt: null,
      captions: [{ language: "eng-US", source: "ASR" }],
    };
    const words: TikTokWords = {
      transcript: {
        videoId: VideoId.parse("tiktok:7301234567890123456"),
        segments: [{ text: "Fry the base until the oil floats.", startMs: 0, endMs: 3000 }],
        generated: true,
        fetchedAt: "2026-11-22T09:00:00.000Z",
      },
      source: "tiktok-vendor",
    };

    it("is taken at Start as a video, short links too, before the web entry can claim it, and a profile is refused", () => {
      expect(onboardingSourceOf(TIKTOK)).toMatchObject({ source: onboardingSources.tiktok, linkKind: "video" });
      expect(onboardingSourceOf("https://vm.tiktok.com/ZMhAbCdEf/")?.source).toBe(onboardingSources.tiktok);
      expect(onboardingSourceOf("https://www.tiktok.com/@bbcnews")).toBeNull();
    });

    it("reads a TikTok and shows it, and writes it with the words it came with only once there's an account", async () => {
      const order: string[] = [];
      const makers = {
        readTikTok: async () => {
          order.push("read");
          return { status: "read", video: clip, words };
        },
        tiktok: async (video, given) => {
          order.push(`written ${video.id} ${given.source}`);
          return makeTikTokOverview();
        },
      } as Pick<OnboardingMakers, "readTikTok" | "tiktok"> as OnboardingMakers;
      const { open, waitToSpend } = account();
      const found: string[] = [];

      const run = onboardingSources.tiktok.make(TIKTOK, makers, {
        onFound: (it) => found.push(`${it.source.kind} | ${it.source.title} | ${it.about}`),
        isCancelled: () => false,
        waitToSpend,
      });
      await settle();

      expect(order).toEqual(["read"]);
      expect(found).toEqual(["tiktok | Sunday jollof | Sunday jollof #jollof\n\nFry the base until the oil floats."]);
      open();
      await run;
      expect(order).toEqual(["read", "written 7301234567890123456 tiktok-vendor"]);
    });

    it.each([
      ["a TikTok it couldn't read", { status: "failed", reason: "unavailable" }, TikTokReadError],
      ["a TikTok with no captions", { status: "read", video: clip, words: null }, TikTokNoCaptionsError],
    ] as const)("stops at %s, having spent nothing", async (_, read, failure) => {
      const makers = {
        readTikTok: async () => read,
        tiktok: async () => {
          throw new Error("never written");
        },
      } as Pick<OnboardingMakers, "readTikTok" | "tiktok"> as OnboardingMakers;

      await expect(
        onboardingSources.tiktok.make(TIKTOK, makers, { onFound: () => {}, isCancelled: () => false, waitToSpend: async () => {} }),
      ).rejects.toBeInstanceOf(failure);
    });

    it("gives its card the creator and the length, and says a clip in seconds", () => {
      const found = foundIn(makeTikTokOverview());
      expect(onboardingSources.tiktok.card(found)).toEqual({ kicker: "Kitchen with Ada · TikTok", facts: { line: "0:42 · TikTok" } });
      expect(onboardingSources.tiktok.yourLink(found, null).line).toMatch(/^42 seconds from Kitchen with Ada, turned into an overview/);
    });
  });
});
