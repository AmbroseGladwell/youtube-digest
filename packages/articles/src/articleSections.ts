import { wordCount, type ArticleLink, type ArticleSection } from "@overview/domain";
import { articleLinks } from "./articleLinks.js";

const HEADINGS = "h1, h2, h3, h4, h5, h6";
const BLOCKS = `${HEADINGS}, p, li, blockquote, pre, figcaption, td, th`;
const TOO_MUCH_LOST = 0.5;

const clean = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

// Only a heading ahead of any text can be the headline, and <title> usually adds the site's name.
const repeatsTitle = (heading: string, title: string): boolean => title.includes(heading) || heading.includes(title);

const anchorOf = (heading: Element): string | null =>
  heading.getAttribute("id") || heading.querySelector("[id]")?.getAttribute("id") || null;

const uniqueLinks = (links: ArticleLink[]): ArticleLink[] =>
  links.filter((link, index) => links.findIndex(({ href }) => href === link.href) === index);

const hasBlockInside = (element: Element): boolean => element.querySelector(BLOCKS) !== null;

// Blocks rather than the article's whole text, so a section can be pointed at. A page built
// out of something else falls back to one section (docs/features/article-extraction.md).
export function articleSections(body: HTMLElement, title: string, pageUrl: string): ArticleSection[] {
  const sections: Array<{ heading: string | null; anchor: string | null; blocks: string[]; links: ArticleLink[] }> = [];
  const linked = new Set<string>();
  for (const element of body.querySelectorAll(BLOCKS)) {
    if (element.matches(HEADINGS)) {
      const heading = clean(element.textContent);
      if (heading !== "" && !(sections.length === 0 && repeatsTitle(heading, clean(title)))) {
        sections.push({ heading, anchor: anchorOf(element), blocks: [], links: [] });
      }
    } else if (!hasBlockInside(element)) {
      const text = clean(element.textContent);
      if (text === "") continue;
      if (sections.length === 0) sections.push({ heading: null, anchor: null, blocks: [], links: [] });
      const section = sections.at(-1)!;
      section.blocks.push(text);
      for (const link of articleLinks(element, pageUrl)) {
        if (!linked.has(link.href)) {
          linked.add(link.href);
          section.links.push(link);
        }
      }
    }
  }

  const kept = sections
    .filter(({ blocks }) => blocks.length > 0)
    .map(({ heading, anchor, blocks, links }) => ({ heading, anchor, text: blocks.join("\n\n"), links }));
  const whole = clean(body.textContent);
  const keptWords = kept.reduce((total, { text }) => total + wordCount(text), 0);
  if (keptWords >= wordCount(whole) * TOO_MUCH_LOST) return kept;
  return whole === "" ? [] : [{ heading: null, anchor: null, text: whole, links: uniqueLinks(articleLinks(body, pageUrl)) }];
}
