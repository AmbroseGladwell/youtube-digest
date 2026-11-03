import { articleReadMinutes } from "@overview/domain";
import styles from "./ArticleOffer.module.scss";
import { articleOfferTestIds } from "./ArticleOfferTestIds.js";

export interface ArticleOfferProps {
  site: string;
  title: string;
  words: number | null;
}

// Designs 77ab–77ae: what's being read, so the reader can tell it's the right thing. Before
// Create that is only what the tab says: we promise not to read a page until then.
export function ArticleOffer({ site, title, words }: ArticleOfferProps) {
  return (
    <div className={styles.card} data-testid={articleOfferTestIds.card}>
      <p className={styles.site} data-testid={articleOfferTestIds.site}>
        {site} · Article
      </p>
      <h2 className={styles.title} data-testid={articleOfferTestIds.title}>
        {title}
      </h2>
      {words !== null && (
        <p className={styles.facts} data-testid={articleOfferTestIds.facts}>
          {words.toLocaleString("en-GB")} words · {articleReadMinutes(words)} min read
        </p>
      )}
    </div>
  );
}
