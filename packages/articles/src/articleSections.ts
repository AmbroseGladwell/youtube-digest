import { wordCount, type ArticleLink, type ArticleSection, type PageLink } from "@overview/domain";
import { articleLinks } from "./articleLinks.js";

const HEADINGS = "h1, h2, h3, h4, h5, h6";
const BLOCKS = `${HEADINGS}, p, li, blockquote, pre, figcaption, td, th`;
const TOO_MUCH_LOST = 0.5;
const PERMALINK_ICON = "svg, img";

const clean = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

// Only a heading ahead of any text can be the headline, and <title> usually adds the site's name.
const repeatsTitle = (heading: string, title: string): boolean => title.includes(heading) || heading.includes(title);

const anchorOf = (heading: Element): string | null =>
  heading.getAttribute("id") || heading.querySelector("[id]")?.getAttribute("id") || null;

const headingText = (heading: Element): string => {
  const anchor = anchorOf(heading);
  const whole = clean(heading.textContent);
  if (anchor === null) {
    return whole;
  }
  const words = heading.cloneNode(true) as Element;
  for (const link of words.querySelectorAll("a[href]")) {
    if (link.getAttribute("href") === `#${anchor}` && link.querySelector(PERMALINK_ICON) !== null) {
      link.remove();
    }
  }
  return clean(words.textContent) || whole;
};

const uniqueLinks = (links: ArticleLink[]): ArticleLink[] =>
  links.filter((link, index) => links.findIndex(({ href }) => href === link.href) === index);

const hasBlockInside = (element: Element): boolean => element.querySelector(BLOCKS) !== null;

// Blocks, so a section can be pointed at: docs/features/article-extraction.md, "Sections".
export const articleSections = (body: HTMLElement, title: string, pageUrl: string): ArticleSection[] => {
  const sections: Array<{ heading: string | null; anchor: string | null; blocks: string[]; links: PageLink[] }> = [];
  const linked = new Set<string>();
  for (const element of body.querySelectorAll(BLOCKS)) {
    if (element.matches(HEADINGS)) {
      const heading = headingText(element);
      if (heading !== "" && !(sections.length === 0 && repeatsTitle(heading, clean(title)))) {
        sections.push({ heading, anchor: anchorOf(element), blocks: [], links: [] });
      }
    } else if (!hasBlockInside(element)) {
      const text = clean(element.textContent);
      if (text === "") {
        continue;
      }
      if (sections.length === 0) {
        sections.push({ heading: null, anchor: null, blocks: [], links: [] });
      }
      const section = sections.at(-1)!;
      const firstSight = (href: string) => {
        if (linked.has(href)) {
          return false;
        }
        linked.add(href);
        return true;
      };
      const fresh = articleLinks(element, pageUrl).filter((link) => firstSight(link.href));
      section.links.push(...fresh.map((link) => ({ ...link, paragraph: section.blocks.length })));
      section.blocks.push(text);
    }
  }

  const kept = sections
    .filter(({ blocks }) => blocks.length > 0)
    .map(({ heading, anchor, blocks, links }) => ({ heading, anchor, text: blocks.join("\n\n"), links }));
  const whole = clean(body.textContent);
  const keptWords = kept.reduce((total, { text }) => total + wordCount(text), 0);
  if (keptWords >= wordCount(whole) * TOO_MUCH_LOST) {
    return kept;
  }
  return whole === ""
    ? []
    : [
        {
          heading: null,
          anchor: null,
          text: whole,
          links: uniqueLinks(articleLinks(body, pageUrl)).map((link) => ({ ...link, paragraph: 0 })),
        },
      ];
};
