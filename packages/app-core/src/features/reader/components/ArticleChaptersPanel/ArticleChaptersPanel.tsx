import { articlePlaceUrl, articleReadMinutes, sourceName, type ArticleDetails, type WebSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ShowOnPage } from "../../useShowOnPage.js";
import styles from "./ArticleChaptersPanel.module.scss";
import { articleChaptersPanelTestIds } from "./ArticleChaptersPanelTestIds.js";

export interface ArticleChaptersPanelProps {
  source: WebSource;
  article: ArticleDetails;
  onPage: ShowOnPage | null;
}

const chapterNumber = (index: number) => String(index + 1).padStart(2, "0");

// Design 77w: laid out as a video's chapters, with a read time where the time range sits. We
// can't see whether a jump landed, so that is said once, at the top. Beside the article we
// can, so there it's said in the row instead (designs 77x, 77y).
export function ArticleChaptersPanel({ source, article, onPage }: ArticleChaptersPanelProps) {
  const worthReading = new Set(article.readAnyway?.chapterIndexes ?? []);
  return (
    <div className={styles.root} data-testid={articleChaptersPanelTestIds.root}>
      <p className={styles.count} data-testid={articleChaptersPanelTestIds.count}>
        {article.chapters.length} {article.chapters.length === 1 ? "chapter" : "chapters"}
      </p>
      {onPage === null && (
        <p className={styles.note}>
          Each chapter opens the article on {sourceName(source)} in a new tab, at that place. Some sites don’t allow jumping, and if the
          article has been edited you may land at the top.
        </p>
      )}
      {article.chapters.map((chapter, index) => {
        const status = onPage?.statusOf(chapter.place) ?? null;
        return (
          <div key={chapter.title} className={styles.row} data-testid={articleChaptersPanelTestIds.row}>
            <div className={styles.meta}>
              <span>
                {chapterNumber(index)} · {articleReadMinutes(chapter.wordCount)} min read
                {worthReading.has(index) ? " · Worth reading" : ""}
              </span>
              {onPage === null ? (
                <a
                  className={styles.open}
                  href={articlePlaceUrl(source.url, chapter.place)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Open the article at ${chapter.title}, in a new tab`}
                  data-testid={articleChaptersPanelTestIds.open}
                >
                  Open the article here
                  <StrokeIcon name="openOut" size={13} />
                </a>
              ) : (
                status !== "missing" && (
                  <button
                    type="button"
                    className={styles.show}
                    onClick={() => onPage.show(chapter.place)}
                    data-testid={articleChaptersPanelTestIds.show}
                  >
                    {status === "shown" ? "Shown on the page" : "Show on the page"}
                  </button>
                )
              )}
            </div>
            <h3 className={styles.title}>{chapter.title}</h3>
            <p className={styles.summary}>{chapter.summary}</p>
            {status === "missing" && (
              <p className={styles.missing} data-testid={articleChaptersPanelTestIds.missing}>
                Couldn’t find this place on the page. The article may have changed since the overview was made.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
