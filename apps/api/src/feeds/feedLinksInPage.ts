import { Parser } from "htmlparser2";
import { ATOM_TYPE, RSS_TYPE, webUrl } from "./feedValues.js";

export interface PageFeedLink {
  url: string;
  title: string | null;
}

const FEED_TYPES = new Set([RSS_TYPE, ATOM_TYPE]);

const isFeedLink = (attributes: Record<string, string>): boolean =>
  (attributes.rel ?? "").toLowerCase().split(/\s+/).includes("alternate") && FEED_TYPES.has((attributes.type ?? "").trim().toLowerCase());

export const feedLinksInPage = (html: string, pageUrl: string): PageFeedLink[] => {
  const links: PageFeedLink[] = [];
  let base = pageUrl;
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === "base") {
          base = webUrl(attributes.href, pageUrl) ?? base;
        }
        if (name === "body") {
          parser.pause();
          return;
        }
        if (name !== "link" || !isFeedLink(attributes)) {
          return;
        }
        const url = webUrl(attributes.href, base);
        if (url !== null && !links.some((link) => link.url === url)) {
          links.push({ url, title: attributes.title?.trim() || null });
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  return links;
};
