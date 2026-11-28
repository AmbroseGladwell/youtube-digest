import { Parser } from "htmlparser2";
import { ATOM_TYPE, RSS_TYPE } from "../feeds/feedValues.js";

export const OG_TITLE = "og:title";

export interface PageMeta {
  meta: ReadonlyMap<string, string>;
  feedUrl: string | null;
  canonicalUrl: string | null;
  title: string | null;
}

const FEED_TYPES = new Set([RSS_TYPE, ATOM_TYPE, "application/xml", "text/xml"]);

const absolute = (href: string | undefined, base: string): string | null => {
  if (href === undefined || href.trim() === "") {
    return null;
  }
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

export const pageMeta = (html: string, pageUrl: string): PageMeta => {
  const meta = new Map<string, string>();
  let feedUrl: string | null = null;
  let canonicalUrl: string | null = null;
  let title: string | null = null;
  let inTitle = false;
  let titleText = "";
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === "meta") {
          const key = (attributes.property ?? attributes.name ?? "").trim().toLowerCase();
          if (key !== "" && attributes.content !== undefined && !meta.has(key)) {
            meta.set(key, attributes.content.trim());
          }
        }
        if (name === "link") {
          const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
          const type = (attributes.type ?? "").trim().toLowerCase();
          if (rel.includes("alternate") && FEED_TYPES.has(type)) {
            feedUrl ??= absolute(attributes.href, pageUrl);
          }
          if (rel.includes("canonical")) {
            canonicalUrl ??= absolute(attributes.href, pageUrl);
          }
        }
        if (name === "title" && title === null) {
          inTitle = true;
        }
        if (name === "body") {
          parser.pause();
        }
      },
      ontext(chunk) {
        if (inTitle) {
          titleText += chunk;
        }
      },
      onclosetag(name) {
        if (name === "title" && inTitle) {
          inTitle = false;
          title = titleText.trim() || null;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return { meta, feedUrl, canonicalUrl, title };
};
