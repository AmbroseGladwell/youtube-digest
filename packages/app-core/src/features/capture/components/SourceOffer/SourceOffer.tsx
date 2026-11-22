import { articleReadMinutes } from "@overview/domain";
import { recipeCounts } from "../../../newOverview/util/recipeCounts.js";
import styles from "./SourceOffer.module.scss";
import { sourceOfferTestIds } from "./SourceOfferTestIds.js";

export interface SourceOfferProps {
  // The channel for a video, the site for a page.
  source: string;
  title: string;
  words?: number | null;
  // Named once the page is read, never before: we don't read a page until Create (144o).
  recipe?: { ingredients: number; steps: number } | null;
  video?: boolean;
}

type OfferedRecipe = NonNullable<SourceOfferProps["recipe"]> | null;

const factsOf = (video: boolean, recipe: OfferedRecipe, words: number | null): string | null => {
  if (video) {
    return null;
  }
  if (recipe !== null) {
    return recipeCounts(recipe, " · ");
  }
  return words !== null ? `${words.toLocaleString("en-GB")} words · ${articleReadMinutes(words)} min read` : null;
};

const kindLabelOf = (video: boolean, recipe: OfferedRecipe): string => {
  if (video) {
    return "Video";
  }
  return recipe === null ? "Article" : "Recipe";
};

// Designs 77ab–77ae and 205f: what's being offered, so the reader can tell it's the right
// thing. One card for a video and a page alike, which is what makes the panel's home read
// as one screen with a changing subject rather than several screens. Before Create that is
// only what the tab says: we promise not to read a page until then, and a video's length
// is not drawn here either.
export const SourceOffer = ({ source, title, words = null, recipe = null, video = false }: SourceOfferProps) => {
  const facts = factsOf(video, recipe, words);

  return (
    <div className={styles.card} data-testid={sourceOfferTestIds.card}>
      <p className={styles.site} data-testid={sourceOfferTestIds.site}>
        {source} · {kindLabelOf(video, recipe)}
      </p>
      <h2 className={styles.title} data-testid={sourceOfferTestIds.title}>
        {title}
      </h2>
      {facts !== null && (
        <p className={styles.facts} data-testid={sourceOfferTestIds.facts}>
          {facts}
        </p>
      )}
    </div>
  );
};
