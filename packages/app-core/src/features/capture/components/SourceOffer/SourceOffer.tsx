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

// Designs 77ab–77ae and 205f: what's being offered, so the reader can tell it's the right
// thing. One card for a video and a page alike, which is what makes the panel's home read
// as one screen with a changing subject rather than several screens. Before Create that is
// only what the tab says: we promise not to read a page until then, and a video's length
// is not drawn here either.
export function SourceOffer({ source, title, words = null, recipe = null, video = false }: SourceOfferProps) {
  const facts = video ? null : recipe !== null ? recipeCounts(recipe, " · ") : words !== null
    ? `${words.toLocaleString("en-GB")} words · ${articleReadMinutes(words)} min read`
    : null;

  return (
    <div className={styles.card} data-testid={sourceOfferTestIds.card}>
      <p className={styles.site} data-testid={sourceOfferTestIds.site}>
        {source} · {video ? "Video" : recipe === null ? "Article" : "Recipe"}
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
}
