import { CoreFields, IN_ONE_LINE_TARGET_WORDS } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const recipeVideoCoreSection: PromptSection = {
  title: "Core",
  key: "structural",
  prompt: () => `
## In one line
What the dish is, in one sentence of ${IN_ONE_LINE_TARGET_WORDS} words at most. This is the line
I read when scanning my library, so it has to be enough on its own for me
to remember which recipe this was.
Good: "A party jollof with a smoky, fried tomato base."
Bad: "A delicious and easy recipe everyone will love."
Never start it with "This video" or "A recipe for". Never repeat the
channel name.`,
  schemaShape: () => ({ inOneLine: CoreFields.shape.inOneLine }),
};
