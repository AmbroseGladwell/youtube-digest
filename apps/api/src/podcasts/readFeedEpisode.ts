import type { PodcastTranscriptLink } from "@overview/domain";
import { Parser } from "htmlparser2";
import { htmlToText } from "./htmlToText.js";

export interface FeedItem {
  guid: string | null;
  title: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  pageUrl: string | null;
  imageUrl: string | null;
  notes: string;
  transcripts: PodcastTranscriptLink[];
  chaptersUrl: string | null;
}

export interface FeedShow {
  title: string | null;
  imageUrl: string | null;
}

// The notes of the episodes beside the wanted one, newest first, which say what the show repeats
// in every episode (docs/features/podcast-on-youtube.md, "An episode's own words").
export type FeedEpisode = { show: FeedShow; item: FeedItem | null; itemsRead: number; neighbourNotes: string[] };

const NEIGHBOURS = 10;

const webUrl = (value: string | undefined): string | null => {
  if (value === undefined) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

export function feedDurationSeconds(value: string): number | null {
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Math.round(Number(text));
    return seconds > 0 ? seconds : null;
  }
  if (!/^\d+(:\d{1,2}){1,2}$/.test(text)) return null;
  const seconds = text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return seconds > 0 ? seconds : null;
}

const feedDate = (value: string): string | null => {
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

const emptyItem = (): FeedItem => ({
  guid: null,
  title: null,
  publishedAt: null,
  durationSeconds: null,
  audioUrl: null,
  pageUrl: null,
  imageUrl: null,
  notes: "",
  transcripts: [],
  chaptersUrl: null,
});

// Reads a feed as it arrives and stops soon after the first item that is wanted, since feeds run
// to tens of megabytes and list the newest first (docs/features/podcast-links.md).
export async function readFeedEpisode(chunks: AsyncIterable<string>, isWanted: (item: FeedItem) => boolean): Promise<FeedEpisode> {
  const show: FeedShow = { title: null, imageUrl: null };
  let item: FeedItem | null = null;
  let found: FeedItem | null = null;
  let done = false;
  let itemsRead = 0;
  const neighbourNotes: string[] = [];
  let text = "";
  let notesHtml = "";
  const open: string[] = [];

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        open.push(name);
        text = "";
        if (name === "item") {
          item = emptyItem();
          notesHtml = "";
          return;
        }
        const href = webUrl(attributes.href ?? attributes.url);
        if (item === null) {
          if (name === "itunes:image" && show.imageUrl === null) show.imageUrl = href;
          return;
        }
        if (name === "enclosure") item.audioUrl ??= webUrl(attributes.url);
        if (name === "itunes:image") item.imageUrl ??= href;
        if (name === "podcast:chapters") item.chaptersUrl ??= webUrl(attributes.url);
        if (name === "podcast:transcript") {
          const url = webUrl(attributes.url);
          if (url !== null)
            item.transcripts.push({
              url,
              type: (attributes.type ?? "").trim().toLowerCase(),
              language: attributes.language?.trim() || null,
            });
        }
      },
      ontext(chunk) {
        text += chunk;
      },
      onclosetag(name) {
        open.pop();
        const value = text.trim();
        if (item === null) {
          if (name === "title" && show.title === null && open.at(-1) === "channel" && value !== "") show.title = value;
          if (name === "url" && open.at(-1) === "image" && show.imageUrl === null) show.imageUrl = webUrl(value);
          text = "";
          return;
        }
        if (name === "item") {
          itemsRead += 1;
          if (notesHtml !== "") item.notes = htmlToText(notesHtml);
          if (found === null && isWanted(item)) {
            found = item;
          } else {
            neighbourNotes.push(item.notes);
            if (found === null && neighbourNotes.length > NEIGHBOURS) neighbourNotes.shift();
          }
          if (found !== null && neighbourNotes.length >= NEIGHBOURS) {
            done = true;
            parser.pause();
          }
          item = null;
        } else if (open.at(-1) === "item") {
          if (name === "title" && value !== "") item.title = value;
          if (name === "guid" && value !== "") item.guid = value;
          if (name === "pubdate") item.publishedAt = feedDate(value);
          if (name === "itunes:duration") item.durationSeconds = feedDurationSeconds(value);
          if (name === "link") item.pageUrl = webUrl(value);
          if ((name === "content:encoded" || (name === "description" && notesHtml === "")) && value !== "") notesHtml = value;
          if (name === "itunes:summary" && notesHtml === "" && value !== "") notesHtml = value;
        }
        text = "";
      },
    },
    { xmlMode: true, recognizeCDATA: true, decodeEntities: true, lowerCaseTags: true },
  );

  for await (const chunk of chunks) {
    parser.write(chunk);
    if (done) break;
  }
  if (!done) parser.end();
  return { show, item: found, itemsRead, neighbourNotes: found === null ? [] : neighbourNotes };
}
