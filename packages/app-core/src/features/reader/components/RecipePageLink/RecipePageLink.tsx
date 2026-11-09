import { articleReadMinutes, formatClock, sourceName, type Source } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ShowOnPage } from "../../useShowOnPage.js";
import styles from "./RecipePageLink.module.scss";
import { recipePageLinkTestIds } from "./RecipePageLinkTestIds.js";

export interface RecipePageLinkProps {
  source: Source;
  // Beside the recipe the link moves that page to its top rather than opening a tab (144l).
  onPage: ShowOnPage | null;
}

// The end of the Summary: the page itself, with what reading it costs (design 144c), or the
// video, with its length (122a).
export function RecipePageLink({ source, onPage }: RecipePageLinkProps) {
  if (source.kind === "youtube") {
    return (
      <a className={styles.link} href={source.url} target="_blank" rel="noopener" data-testid={recipePageLinkTestIds.link}>
        Open the video on YouTube{source.durationMs ? ` · ${formatClock(source.durationMs / 1000)}` : ""}
        <StrokeIcon name="openOut" size={13} />
      </a>
    );
  }
  const minutes = articleReadMinutes(source.wordCount);
  return onPage === null ? (
    <a className={styles.link} href={source.url} target="_blank" rel="noopener" data-testid={recipePageLinkTestIds.link}>
      See the full recipe on {sourceName(source)} · {minutes} min read
      <StrokeIcon name="openOut" size={13} />
    </a>
  ) : (
    <button
      type="button"
      className={styles.link}
      onClick={() => onPage.show({ anchor: null, quote: source.title })}
      data-testid={recipePageLinkTestIds.link}
    >
      Back to the top of the recipe · {minutes} min
    </button>
  );
}
