import { articleReadMinutes, domainOf } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { recipeCounts } from "../../util/recipeCounts.js";
import { ArticleFailureNotice } from "../../../capture/components/ArticleFailureNotice/ArticleFailureNotice.js";
import type { ArticleLink } from "../../useArticleLink.js";
import { pastedLinkFailureCopy, type ReaderPlace } from "../../util/pastedLinkFailureCopy.js";
import styles from "./ArticleLinkStatus.module.scss";
import { articleLinkStatusTestIds } from "./ArticleLinkStatusTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface ArticleLinkStatusProps {
  link: ArticleLink;
  url: string;
  place: ReaderPlace;
  onRetry: () => void;
  onClear: () => void;
  onOpened?: () => void;
}

const madeOn = (savedAt: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

// Designs 77am–77ar: under the field, what the link turned out to be.
export function ArticleLinkStatus({ link, url, place, onRetry, onClear, onOpened }: ArticleLinkStatusProps) {
  switch (link.status) {
    case "none":
      return null;
    case "reading":
      return (
        <p className={styles.line} role="status" data-testid={articleLinkStatusTestIds.reading}>
          Reading the link
        </p>
      );
    case "found":
      return (
        <p className={styles.line} data-testid={articleLinkStatusTestIds.found}>
          {link.article.recipe === null
            ? `Article on ${link.article.siteName ?? domainOf(link.article.url)} · ${articleReadMinutes(link.article.wordCount)} min read`
            : `Recipe on ${link.article.siteName ?? domainOf(link.article.url)} · ${recipeCounts({ ingredients: link.article.recipe.ingredients.length, steps: link.article.recipe.steps.length })}`}
        </p>
      );
    case "held":
      return (
        <div className={styles.held} data-testid={articleLinkStatusTestIds.held}>
          <span>
            You already have this article.
            {link.savedAt !== null && ` You made an overview of it on ${madeOn(link.savedAt)}.`}
          </span>
          <PageLink className={styles.open} to={Routes.overview(link.overviewId)} onClick={onOpened} data-testid={articleLinkStatusTestIds.openHeld}>
            Open your overview
          </PageLink>
        </div>
      );
    case "unreachable":
      return (
        <p className={styles.line} role="alert" data-testid={articleLinkStatusTestIds.unreachable}>
          We couldn’t check that link just now.{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        </p>
      );
    case "failed": {
      const copy = pastedLinkFailureCopy(link.failure, url, place);
      return <ArticleFailureNotice copy={copy} href={copy.href} after={copy.after} onWay={copy.way === "tryAgain" ? onRetry : onClear} />;
    }
  }
}
