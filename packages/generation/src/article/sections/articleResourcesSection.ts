import { MOST_RESOURCES } from "@overview/domain";
import { z } from "zod";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { offeredLinks } from "../offeredLinks.js";

const namedOnce = (indexes: number[]) => new Set(indexes).size === indexes.length;

export const articleResourcesSection: ArticlePromptSection = {
  key: "structural",
  prompt: () => `
## Resources it links to
Some paragraphs below are followed by the links that part of the piece
makes, each numbered as "link N". Choose up to ${MOST_RESOURCES} that someone who
reads this note instead of the piece would want to open: a toolkit, guide,
study, dataset, tool or reference that the piece recommends or rests on.
Leave out the site's own other articles unless the piece offers one as a
resource, a citation for a passing fact, a profile, a shop, and the
author's own promotion. Give their numbers as resourceLinks, the most
useful first. Give an empty list when none is worth opening, which is
often the right answer.

The note lists these links on their own, so a key point never needs to
spend itself on pointing the reader to them.`,
  schemaShape: (input) => ({
    resourceLinks: z
      .array(
        z
          .int()
          .min(0)
          .max(offeredLinks(input.article).length - 1),
      )
      .max(MOST_RESOURCES)
      .refine(namedOnce, "name each link once"),
  }),
};
