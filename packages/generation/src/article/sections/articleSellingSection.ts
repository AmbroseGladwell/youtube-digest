import { Selling } from "@overview/domain";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";

export const articleSellingSection: ArticlePromptSection = {
  key: "selling",
  prompt: () => `
## Selling
Anything the author or the publication is pitching in the piece itself:
their own paid product, their own free promotion, a sponsor or affiliate
deal, or nothing. A sponsored post counts, and so do affiliate links the
advice leans on. Note it even when it doesn't change the verdict, because
the pattern across many overviews is what matters, not the individual flag.
A site's own prompt to subscribe or sign up for a newsletter is not
selling, so leave it out. Also say, as compromisesContent, whether the
pitch distorts the actual advice.`,
  schemaShape: () => Selling.shape,
};
