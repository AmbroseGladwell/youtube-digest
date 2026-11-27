import { Parser } from "htmlparser2";
import { htmlToText } from "@overview/transcripts";
import { FEED_TEXT_TAGS, feedDate, feedDurationSeconds, webUrl } from "./feedValues.js";

export type FeedFormat = "rss" | "atom";
export type FeedEntryKind = "episode" | "video" | "article";

export interface FeedEntry {
  id: string;
  kind: FeedEntryKind;
  title: string | null;
  pageUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  youTubeVideoId: string | null;
  imageUrl: string | null;
  description: string;
}

export interface FeedListing {
  format: FeedFormat;
  title: string | null;
  siteUrl: string | null;
  imageUrl: string | null;
  entries: FeedEntry[];
  entriesRead: number;
  reachedKnown: boolean;
}

export type FeedItemsRead = { status: "feed"; feed: FeedListing } | { status: "notAFeed" };

export interface ReadFeedItemsOptions {
  feedUrl: string;
  mostEntries: number;
  isKnown: (id: string) => boolean;
  newestKnownAt: string | null;
}

export const MOST_DESCRIPTION_CHARACTERS = 2_000;

const ROOTS: Record<string, FeedFormat> = { rss: "rss", "rdf:rdf": "rss", feed: "atom" };
const ENTRY_TAGS = new Set(["item", "entry"]);
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|$)/i;
const SHORT_TEXT_TAGS = [FEED_TEXT_TAGS.description, "summary", FEED_TEXT_TAGS.itunesSummary, "media:description"];
const LONG_TEXT_TAGS = [FEED_TEXT_TAGS.contentEncoded, "content"];
const PAGE_TYPE = /^(text\/html|application\/xhtml\+xml)$/;
const DATE_TAGS = ["pubdate", "published", "dc:date", "updated"];
const BLOCK_TAGS = new Set(["p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr"]);

interface EntryDraft {
  guid: string | null;
  title: string | null;
  pageUrl: string | null;
  dates: Partial<Record<string, string>>;
  durationSeconds: number | null;
  audioUrl: string | null;
  youTubeVideoId: string | null;
  imageUrl: string | null;
  texts: Partial<Record<string, string>>;
}

const emptyDraft = (): EntryDraft => ({
  guid: null,
  title: null,
  pageUrl: null,
  dates: {},
  durationSeconds: null,
  audioUrl: null,
  youTubeVideoId: null,
  imageUrl: null,
  texts: {},
});

const isAudio = (type: string | undefined, url: string | null): boolean =>
  url !== null && (type === undefined || type.trim() === "" ? AUDIO_FILE.test(url) : type.trim().toLowerCase().startsWith("audio/"));

const isImage = (type: string | undefined, medium: string | undefined): boolean =>
  medium === "image" || (type ?? "").trim().toLowerCase().startsWith("image/");

const youTubeVideoIdOf = (pageUrl: string | null): string | null => {
  if (pageUrl === null) {
    return null;
  }
  const url = new URL(pageUrl);
  return /(^|\.)youtube\.com$/.test(url.hostname) && url.pathname === "/watch" ? url.searchParams.get("v") : null;
};

export const shortDescription = (html: string): string => {
  const text = htmlToText(html);
  if (text.length <= MOST_DESCRIPTION_CHARACTERS) {
    return text;
  }
  const cut = text.slice(0, MOST_DESCRIPTION_CHARACTERS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > MOST_DESCRIPTION_CHARACTERS / 2 ? cut.slice(0, lastSpace) : cut}…`;
};

const firstOf = (values: Partial<Record<string, string>>, keys: string[]): string | undefined =>
  keys.map((key) => values[key]).find((value) => value !== undefined && value !== "");

const entryKindOf = (youTubeVideoId: string | null, audioUrl: string | null): FeedEntryKind => {
  if (youTubeVideoId !== null) {
    return "video";
  }
  return audioUrl === null ? "article" : "episode";
};

const entryOf = (draft: EntryDraft): FeedEntry | null => {
  const youTubeVideoId = draft.youTubeVideoId ?? youTubeVideoIdOf(draft.pageUrl);
  const id = draft.guid ?? draft.pageUrl ?? draft.audioUrl;
  if (id === null || (draft.pageUrl === null && draft.audioUrl === null && youTubeVideoId === null)) {
    return null;
  }
  const date = firstOf(draft.dates, DATE_TAGS);
  const text = firstOf(draft.texts, SHORT_TEXT_TAGS) ?? firstOf(draft.texts, LONG_TEXT_TAGS);
  return {
    id,
    kind: entryKindOf(youTubeVideoId, draft.audioUrl),
    title: draft.title,
    pageUrl: draft.pageUrl,
    publishedAt: date === undefined ? null : feedDate(date),
    durationSeconds: draft.durationSeconds,
    audioUrl: draft.audioUrl,
    youTubeVideoId,
    imageUrl: draft.imageUrl,
    description: text === undefined ? "" : shortDescription(text),
  };
};

const newestFirst = (entries: FeedEntry[]): FeedEntry[] =>
  entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (b.entry.publishedAt ?? "").localeCompare(a.entry.publishedAt ?? "") || a.index - b.index)
    .map(({ entry }) => entry);

const isAlternateLink = (attributes: Record<string, string>): boolean => {
  const rel = (attributes.rel ?? "alternate").trim().toLowerCase();
  const type = attributes.type?.trim().toLowerCase();
  return rel === "alternate" && (type === undefined || PAGE_TYPE.test(type));
};

// Why reading can stop early, and when it can't: docs/features/followed-feeds.md, "Reading a feed".
export const readFeedItems = async (chunks: AsyncIterable<string>, options: ReadFeedItemsOptions): Promise<FeedItemsRead> => {
  const { feedUrl, mostEntries, isKnown, newestKnownAt } = options;
  let format: FeedFormat | null = null;
  let notAFeed = false;
  let done = false;
  let reachedKnown = false;
  let newestFirstSoFar = true;
  let previousDate: string | null = null;
  let entriesRead = 0;
  let entries: FeedEntry[] = [];
  let draft: EntryDraft | null = null;
  const feed = { title: null as string | null, siteUrl: null as string | null, imageUrl: null as string | null };
  const open: string[] = [];
  const texts: string[] = [];

  const parent = (): string | undefined => open.at(-2);

  const keep = (entry: FeedEntry) => {
    if (previousDate !== null && entry.publishedAt !== null && entry.publishedAt > previousDate) {
      newestFirstSoFar = false;
    }
    previousDate = entry.publishedAt ?? previousDate;
    if (isKnown(entry.id)) {
      reachedKnown ||= newestKnownAt === null || entry.publishedAt === null || entry.publishedAt >= newestKnownAt;
      return;
    }
    entries.push(entry);
    if (entries.length > mostEntries * 2) {
      entries = newestFirst(entries).slice(0, mostEntries);
    }
  };

  const shouldStop = (): boolean => newestFirstSoFar && (reachedKnown || entries.length >= mostEntries);

  const onEntryOpen = (name: string, attributes: Record<string, string>, entry: EntryDraft) => {
    const url = webUrl(attributes.url ?? attributes.href, feedUrl);
    if (name === "enclosure" || (name === "link" && attributes.rel?.trim().toLowerCase() === "enclosure")) {
      if (isAudio(attributes.type, url)) {
        entry.audioUrl ??= url;
      } else if (isImage(attributes.type, undefined)) {
        entry.imageUrl ??= url;
      }
    }
    if (name === "media:content") {
      if (attributes.medium === "audio" || isAudio(attributes.type, null)) {
        entry.audioUrl ??= url;
      } else if (isImage(attributes.type, attributes.medium)) {
        entry.imageUrl ??= url;
      }
    }
    if (name === "itunes:image" || name === "media:thumbnail") {
      entry.imageUrl ??= url;
    }
    if (name === "link" && attributes.href !== undefined && isAlternateLink(attributes)) {
      entry.pageUrl ??= url;
    }
  };

  const onEntryClose = (name: string, value: string, entry: EntryDraft) => {
    if (name === "title" && parent() !== "media:group" && value !== "") {
      entry.title ??= value.replace(/\s+/g, " ");
    }
    if ((name === "guid" || name === "id") && value !== "") {
      entry.guid ??= value;
    }
    if (name === "link" && value !== "") {
      entry.pageUrl ??= webUrl(value, feedUrl);
    }
    if (name === "yt:videoid" && value !== "") {
      entry.youTubeVideoId ??= value;
    }
    if (name === "itunes:duration") {
      entry.durationSeconds ??= feedDurationSeconds(value);
    }
    if (DATE_TAGS.includes(name) && value !== "") {
      entry.dates[name] ??= value;
    }
    if ((SHORT_TEXT_TAGS.includes(name) || LONG_TEXT_TAGS.includes(name)) && value !== "") {
      entry.texts[name] ??= value;
    }
  };

  const onFeedOpen = (name: string, attributes: Record<string, string>) => {
    if (name === "itunes:image") {
      feed.imageUrl ??= webUrl(attributes.href, feedUrl);
    }
    if (name === "link" && attributes.href !== undefined && isAlternateLink(attributes)) {
      feed.siteUrl ??= webUrl(attributes.href, feedUrl);
    }
  };

  const onFeedClose = (name: string, value: string) => {
    const onTheFeed = parent() === "channel" || parent() === "feed";
    if (name === "title" && onTheFeed && value !== "") {
      feed.title ??= value.replace(/\s+/g, " ");
    }
    if (name === "link" && parent() === "channel" && value !== "") {
      feed.siteUrl ??= webUrl(value, feedUrl);
    }
    if (name === "url" && parent() === "image") {
      feed.imageUrl ??= webUrl(value, feedUrl);
    }
    if ((name === "logo" || name === "icon") && parent() === "feed") {
      feed.imageUrl ??= webUrl(value, feedUrl);
    }
  };

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (format === null) {
          format = ROOTS[name] ?? null;
          if (format === null) {
            notAFeed = true;
            parser.pause();
            return;
          }
        }
        open.push(name);
        texts.push("");
        if (ENTRY_TAGS.has(name)) {
          draft = emptyDraft();
        } else if (draft === null) {
          onFeedOpen(name, attributes);
        } else {
          onEntryOpen(name, attributes, draft);
        }
      },
      ontext(chunk) {
        if (texts.length > 0) {
          texts[texts.length - 1] += chunk;
        }
      },
      onclosetag(name) {
        const raw = texts.pop() ?? "";
        const value = raw.trim();
        if (texts.length > 0 && !ENTRY_TAGS.has(name)) {
          texts[texts.length - 1] += BLOCK_TAGS.has(name) ? `\n${raw}\n` : raw;
        }
        if (ENTRY_TAGS.has(name) && draft !== null) {
          entriesRead += 1;
          const entry = entryOf(draft);
          draft = null;
          if (entry !== null) {
            keep(entry);
          }
          if (shouldStop()) {
            done = true;
            parser.pause();
          }
        } else if (draft === null) {
          onFeedClose(name, value);
        } else {
          onEntryClose(name, value, draft);
        }
        open.pop();
      },
    },
    { xmlMode: true, recognizeCDATA: true, decodeEntities: true, lowerCaseTags: true },
  );

  for await (const chunk of chunks) {
    parser.write(chunk);
    if (done || notAFeed) {
      break;
    }
  }
  if (!done && !notAFeed) {
    parser.end();
  }
  if (format === null) {
    return { status: "notAFeed" };
  }
  return {
    status: "feed",
    feed: { format, ...feed, entries: newestFirst(entries).slice(0, mostEntries), entriesRead, reachedKnown },
  };
};
