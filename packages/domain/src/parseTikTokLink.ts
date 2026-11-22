export type TikTokLink = { kind: "video"; videoId: string } | { kind: "short"; url: string } | { kind: "not-a-video" };

const TIKTOK_HOSTS = new Set(["tiktok.com", "m.tiktok.com"]);
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);
const VIDEO_ID = /^\d{8,25}$/;

const video = (id: string | undefined): TikTokLink =>
  id !== undefined && VIDEO_ID.test(id) ? { kind: "video", videoId: id } : { kind: "not-a-video" };

function tikTokPath(segments: readonly string[], url: URL): TikTokLink {
  const [first, second, third] = segments;
  if (first?.startsWith("@") === true) return second === "video" ? video(third) : { kind: "not-a-video" };
  if (first === "t" && second !== undefined) return { kind: "short", url: url.href };
  if (first === "embed") return video(second === "v2" ? third : second);
  if (first === "player" && second === "v1") return video(third);
  if (first === "v" && second !== undefined) return video(second.replace(/\.html$/, ""));
  if (first === "share" && second === "video") return video(third);
  return { kind: "not-a-video" };
}

// Which kind of TikTok link this is, from its shape alone, or null for any other address
// (docs/features/tiktok-links.md).
export function parseTikTokLink(link: string): TikTokLink | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (SHORT_HOSTS.has(host)) return url.pathname.length > 1 ? { kind: "short", url: url.href } : { kind: "not-a-video" };
  if (!TIKTOK_HOSTS.has(host)) return null;
  return tikTokPath(
    url.pathname.split("/").filter((segment) => segment !== ""),
    url,
  );
}
