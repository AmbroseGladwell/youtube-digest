import { getDomain, getHostname } from "tldts";
import {
  APPLE_PODCAST_HOSTS,
  FACEBOOK_HOSTS,
  FACEBOOK_SHORT_HOSTS,
  INSTAGRAM_HOSTS,
  SPOTIFY_HOSTS,
  SPOTIFY_SHORT_HOSTS,
  TIKTOK_HOSTS,
  TIKTOK_SHORT_HOSTS,
  YOUTUBE_HOSTS,
  type Source,
} from "@overview/domain";
import type { LibrarySourceId } from "../types/LibraryFilters.js";

export const LIBRARY_SOURCE_PLATFORMS = ["youtube", "tiktok", "instagram", "facebook", "spotify", "applePodcasts", "website"] as const;
export type LibrarySourcePlatform = (typeof LIBRARY_SOURCE_PLATFORMS)[number];

export interface LibrarySource {
  id: LibrarySourceId;
  name: string;
  domain: string | null;
  platform: LibrarySourcePlatform;
}

type KnownPlatform = Exclude<LibrarySourcePlatform, "website">;

const PLATFORM_NAME: Record<KnownPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  spotify: "Spotify",
  applePodcasts: "Apple Podcasts",
};

const PLATFORM_HOSTS: [KnownPlatform, ReadonlySet<string>][] = [
  ["youtube", YOUTUBE_HOSTS],
  ["tiktok", new Set([...TIKTOK_HOSTS, ...TIKTOK_SHORT_HOSTS])],
  ["instagram", INSTAGRAM_HOSTS],
  ["facebook", new Set([...FACEBOOK_HOSTS, ...FACEBOOK_SHORT_HOSTS])],
  ["spotify", new Set([...SPOTIFY_HOSTS, ...SPOTIFY_SHORT_HOSTS])],
  ["applePodcasts", APPLE_PODCAST_HOSTS],
];

const platformSource = (platform: KnownPlatform): LibrarySource => ({
  id: platform as LibrarySourceId,
  name: PLATFORM_NAME[platform],
  domain: null,
  platform,
});

const siteDomainOf = (url: string): string | null => {
  const domain = getDomain(url);
  if (domain !== null) {
    return domain;
  }
  return getHostname(url)?.replace(/^www\./, "") || null;
};

const fromLink = (url: string, siteName: string | null): LibrarySource => {
  const host = getHostname(url)?.replace(/^www\./, "") ?? "";
  const known = PLATFORM_HOSTS.find(([, hosts]) => hosts.has(host))?.[0];
  if (known !== undefined) {
    return platformSource(known);
  }
  const domain = siteDomainOf(url);
  if (domain === null) {
    return { id: `site:${url}` as LibrarySourceId, name: siteName ?? url, domain: null, platform: "website" };
  }
  return { id: `site:${domain}` as LibrarySourceId, name: siteName?.trim() || domain, domain, platform: "website" };
};

// Worked out on the device; the domain never leaves it: docs/features/library-filters.md, "Source".
export const librarySourceOf = (source: Source): LibrarySource => {
  switch (source.kind) {
    case "youtube":
    case "tiktok":
    case "instagram":
    case "facebook":
      return platformSource(source.kind);
    case "web":
      return fromLink(source.url, source.siteName);
    case "podcast":
      return fromLink(source.sharedFrom, null);
  }
};
