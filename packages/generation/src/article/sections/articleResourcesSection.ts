import { MOST_RESOURCES, RESOURCE_WHY_MOST_WORDS, RESOURCE_WHY_TARGET_WORDS, wordCount } from "@overview/domain";
import { z } from "zod";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { offeredLinks } from "../offeredLinks.js";

const namedOnce = (resources: Array<{ link: number }>) => new Set(resources.map(({ link }) => link)).size === resources.length;

export const articleResourcesSection: ArticlePromptSection = {
  key: "structural",
  prompt: () => `
## Resources it links to
Some paragraphs below are followed by the links they make, each numbered
as "link N". Choose up to ${MOST_RESOURCES} that someone who reads this note instead
of the piece would want to open: a toolkit, guide, study, dataset, tool or
reference that the piece recommends or rests on. Leave out the site's own
other articles unless the piece offers one as a resource, the site's own
help, sharing or licensing pages, a citation for a passing fact, a
profile, a shop, and the author's own promotion. Give each
as its number, the most useful first. Give an empty list when none is
worth opening, which is often the right answer.

For each, write why in one sentence of ${RESOURCE_WHY_TARGET_WORDS} words at most: what the piece
says it is and why a reader would open it, taken only from the paragraph
around the link. You have not seen the page it goes to, so never describe
it beyond what the piece says. Never start with the link's own name, which
is shown beside it.
Good: "The author's starting point for cognitive accessibility, gathering
guides, checklists and talks on designing for neurodivergent people."
Bad: "A great resource worth checking out."

The note lists these links on their own, so a key point never needs to
spend itself on pointing the reader to them.`,
  schemaShape: (input) => ({
    resources: z
      .object({
        link: z
          .int()
          .min(0)
          .max(offeredLinks(input.article).length - 1),
        why: z.string().refine((why) => wordCount(why) <= RESOURCE_WHY_MOST_WORDS, `max ${RESOURCE_WHY_MOST_WORDS} words`),
      })
      .array()
      .max(MOST_RESOURCES)
      .refine(namedOnce, "name each link once"),
  }),
};
