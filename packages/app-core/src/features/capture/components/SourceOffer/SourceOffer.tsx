import { articleReadMinutes } from "@overview/domain";
import { recipeCounts } from "../../../newOverview/util/recipeCounts.js";
import styles from "./SourceOffer.module.scss";
import { sourceOfferTestIds } from "./SourceOfferTestIds.js";

export interface SourceOfferProps {
  source: string;
  title: string;
  words?: number | null;
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

// Only what the tab says before Create: docs/features/article-panel.md, "Nothing is read before Create".
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
