import { articleReadMinutes, clipPlatformName, formatClock, isClipSource, sourceName, type Source } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ShowOnPage } from "../../useShowOnPage.js";
import styles from "./RecipePageLink.module.scss";
import { recipePageLinkTestIds } from "./RecipePageLinkTestIds.js";

export interface RecipePageLinkProps {
  source: Source;
  onPage: ShowOnPage | null;
}

export const RecipePageLink = ({ source, onPage }: RecipePageLinkProps) => {
  if (source.kind === "youtube" || isClipSource(source)) {
    return (
      <a className={styles.link} href={source.url} target="_blank" rel="noopener" data-testid={recipePageLinkTestIds.link}>
        Open the video on {source.kind === "youtube" ? "YouTube" : clipPlatformName(source)}
        {source.durationMs ? ` · ${formatClock(source.durationMs / 1000)}` : ""}
        <StrokeIcon name="openOut" size={13} />
      </a>
    );
  }
  // An episode the kind check calls a recipe gets the default note.
  if (source.kind === "podcast") {
    return null;
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
};
