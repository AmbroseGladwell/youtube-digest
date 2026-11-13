export interface ListedChannel {
  channelId: string;
  title: string;
}

export interface ListedUpload {
  videoId: string;
  title: string;
  lengthSeconds: number | null;
  age: string | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function everyValueAt(value: unknown, key: string, found: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) everyValueAt(item, key, found);
  } else if (isObject(value)) {
    for (const [name, inner] of Object.entries(value)) {
      if (name === key) found.push(inner);
      everyValueAt(inner, key, found);
    }
  }
  return found;
}

const text = (value: unknown): string => {
  if (!isObject(value)) return typeof value === "string" ? value : "";
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  return Array.isArray(value.runs) ? value.runs.map((run) => (isObject(run) && typeof run.text === "string" ? run.text : "")).join("") : "";
};

export function clockSeconds(value: string): number | null {
  if (!/^\d+(:\d{2}){1,2}$/.test(value.trim())) return null;
  return value
    .trim()
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
}

// YouTube's own page data, read loosely: these are the web client's screens, not an API, so a
// field that moves reads as nothing found rather than as an error
// (docs/features/podcast-on-youtube.md, "What is read from YouTube").
export function channelsIn(searchResponse: unknown): ListedChannel[] {
  return everyValueAt(searchResponse, "channelRenderer").flatMap((channel) =>
    isObject(channel) && typeof channel.channelId === "string" ? [{ channelId: channel.channelId, title: text(channel.title) }] : [],
  );
}

function fromLockup(lockup: unknown): ListedUpload | null {
  if (!isObject(lockup) || typeof lockup.contentId !== "string") return null;
  const [metadata] = everyValueAt(lockup, "lockupMetadataViewModel");
  const badges = everyValueAt(lockup, "thumbnailBadgeViewModel").map((badge) => (isObject(badge) ? text(badge.text) : ""));
  const parts = everyValueAt(lockup, "metadataParts")
    .flatMap((list) => (Array.isArray(list) ? list : []))
    .map((part) => (isObject(part) ? text(part.text) : ""));
  return {
    videoId: lockup.contentId,
    title: isObject(metadata) ? text(metadata.title) : "",
    lengthSeconds: badges.map(clockSeconds).find((seconds) => seconds !== null) ?? null,
    age: parts.find((part) => part.endsWith(" ago")) ?? null,
  };
}

function fromVideoRenderer(video: unknown): ListedUpload | null {
  if (!isObject(video) || typeof video.videoId !== "string") return null;
  const length = text(video.lengthText);
  const age = text(video.publishedTimeText);
  return { videoId: video.videoId, title: text(video.title), lengthSeconds: clockSeconds(length), age: age === "" ? null : age };
}

export function uploadsIn(browseResponse: unknown): { uploads: ListedUpload[]; continuation: string | null } {
  const uploads = [
    ...everyValueAt(browseResponse, "lockupViewModel").map(fromLockup),
    ...everyValueAt(browseResponse, "videoRenderer").map(fromVideoRenderer),
  ].filter((upload): upload is ListedUpload => upload !== null && upload.title !== "");
  const [command] = everyValueAt(everyValueAt(browseResponse, "continuationItemRenderer"), "continuationCommand");
  return { uploads, continuation: isObject(command) && typeof command.token === "string" ? command.token : null };
}

const DAYS: Record<string, number> = { second: 0, minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 };

// "3 weeks ago" as the days it could mean, with the slack the rounding leaves.
export function ageInDays(age: string): { fewest: number; most: number } | null {
  const match = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/.exec(age);
  if (match === null) return null;
  const count = Number(match[1]);
  const unit = DAYS[match[2]!]!;
  if (unit === 0) return { fewest: 0, most: 1.1 };
  if (unit === 1) return { fewest: count - 0.5, most: count + 1.5 };
  return { fewest: count * unit - 1, most: (count + 1) * unit };
}
