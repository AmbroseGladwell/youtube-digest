import type { ArticleLink } from "@overview/domain";
import { isPageFurniture } from "./isPageFurniture.js";

const FEWEST_LETTERS = 3;
const MOST_WORDS = 20;

const UNNAMED =
  /^(here|click here|this|this one|link|this link|source|sources|more|read more|learn more|see more|continue reading|via|website|site|page|article|pdf|\[?\d+\]?|https?:\/\/.*|www\..*)$/i;

const PICTURE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)$/i;

const clean = (text: string | null): string => (text ?? "").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();

const isNamed = (text: string): boolean =>
  text.replace(/[^\p{L}]/gu, "").length >= FEWEST_LETTERS && text.split(" ").length <= MOST_WORDS && !UNNAMED.test(text);

const outboundHref = (href: string | null, pageUrl: string): string | null => {
  if (href === null || href.startsWith("#")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || PICTURE.test(url.pathname)) {
    return null;
  }
  const page = new URL(pageUrl);
  url.hash = "";
  const samePlace = url.origin === page.origin && url.pathname === page.pathname;
  const siteIndex = url.origin === page.origin && (url.pathname === "/" || url.pathname === "");
  return samePlace || siteIndex ? null : url.href;
};

// Not one a reader would follow: "here", a picture, the same page, the front page, or page furniture.
export const articleLinks = (block: Element, pageUrl: string): ArticleLink[] => {
  return [...block.querySelectorAll("a[href]")].flatMap((anchor) => {
    const text = clean(anchor.textContent);
    const href = outboundHref(anchor.getAttribute("href"), pageUrl);
    return href !== null && isNamed(text) && !isPageFurniture(anchor) ? [{ text, href }] : [];
  });
};
