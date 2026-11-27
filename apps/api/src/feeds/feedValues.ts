export const RSS_TYPE = "application/rss+xml";
export const ATOM_TYPE = "application/atom+xml";

export const FEED_TEXT_TAGS = {
  description: "description",
  itunesSummary: "itunes:summary",
  contentEncoded: "content:encoded",
} as const;

export const webUrl = (value: string | undefined, base?: string): string | null => {
  if (value === undefined || value.trim() === "") {
    return null;
  }
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

export const feedDate = (value: string): string | null => {
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

export const feedDurationSeconds = (value: string): number | null => {
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Math.round(Number(text));
    return seconds > 0 ? seconds : null;
  }
  if (!/^\d+(:\d{1,2}){1,2}$/.test(text)) {
    return null;
  }
  const seconds = text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return seconds > 0 ? seconds : null;
};
