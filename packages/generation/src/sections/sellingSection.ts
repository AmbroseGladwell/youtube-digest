import { Selling } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const sellingSection: PromptSection = {
  title: "Selling",
  key: "selling",
  prompt: () => `
## Selling
Anything the creator is pitching: their own paid product, their own free
promotion, a sponsor or affiliate deal, or nothing. Take it from the
transcript and the description. Note it even when it doesn't change the
verdict, because the pattern across many overviews is what matters, not
the individual flag. Engagement-bait (asking for likes, comments,
subscriptions) is not selling — leave it out. Also say, as
compromisesContent, whether the pitch distorts the actual advice.`,
  schemaShape: () => Selling.shape,
};
