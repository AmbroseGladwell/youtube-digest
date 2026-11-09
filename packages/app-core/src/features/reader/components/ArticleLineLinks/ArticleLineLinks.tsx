import {
  articlePlaceUrl,
  articleReadMinutes,
  READ_ANYWAY_SECTION,
  sourceName,
  type ArticleChapter,
  type ArticleDetails,
  type NoteLine,
  type WebSource,
} from "@overview/domain";
import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ShowOnPage } from "../../useShowOnPage.js";
import styles from "./ArticleLineLinks.module.scss";
import { articleLineLinksTestIds } from "./ArticleLineLinksTestIds.js";

export interface ArticleLineLinksProps {
  line: NoteLine;
  source: WebSource;
  article: ArticleDetails;
  // Beside the article these move the page, and drop the icon that says they leave (77r).
  onPage: ShowOnPage | null;
}

interface PlaceLinkProps {
  chapter: ArticleChapter;
  source: WebSource;
  onPage: ShowOnPage | null;
  className: string | undefined;
  testId: string;
  label?: string | undefined;
  children: ReactNode;
}

function PlaceLink({ chapter, source, onPage, className, testId, label, children }: PlaceLinkProps) {
  return onPage === null ? (
    <a
      className={className}
      href={articlePlaceUrl(source.url, chapter.place)}
      target="_blank"
      rel="noopener"
      aria-label={label}
      data-testid={testId}
    >
      {children}
    </a>
  ) : (
    <button type="button" className={`${className} ${styles.onPage}`} onClick={() => onPage.show(chapter.place)} data-testid={testId}>
      {children}
    </button>
  );
}

// What a line of an article's note points at: its chapter, in the slot where a video's line
// shows a timestamp, and at the end of Read it anyway the parts named and the full article
// with its cost (designs 77o, 77s–77v).
export function ArticleLineLinks({ line, source, article, onPage }: ArticleLineLinksProps) {
  const leaving = onPage === null && <StrokeIcon name="openOut" size={13} />;

  if (line.chapterIndex !== undefined) {
    const chapter = article.chapters[line.chapterIndex];
    return chapter === undefined ? null : (
      <PlaceLink
        chapter={chapter}
        source={source}
        onPage={onPage}
        className={styles.chapterLink}
        testId={articleLineLinksTestIds.chapterLink}
        label={`${chapter.title}, opens the article in a new tab`}
      >
        {chapter.title}
        {leaving}
      </PlaceLink>
    );
  }

  if (line.section !== READ_ANYWAY_SECTION || line.heading) {
    return null;
  }

  const named = (article.readAnyway?.chapterIndexes ?? []).flatMap((index) => article.chapters[index] ?? []);
  const fullArticleLabel = `Read the full article on ${sourceName(source)} · ${articleReadMinutes(source.wordCount)} min`;
  return (
    <>
      {named.length > 0 && (
        <ul className={styles.chapters}>
          {named.map((chapter) => (
            <li key={chapter.title}>
              <PlaceLink
                chapter={chapter}
                source={source}
                onPage={onPage}
                className={styles.chapterChip}
                testId={articleLineLinksTestIds.namedChapter}
              >
                {chapter.title}
                <span className={styles.chipTime}>
                  {articleReadMinutes(chapter.wordCount)} min
                  {leaving}
                </span>
              </PlaceLink>
            </li>
          ))}
        </ul>
      )}
      {onPage === null ? (
        <a
          className={styles.fullArticle}
          href={source.url}
          target="_blank"
          rel="noopener"
          data-testid={articleLineLinksTestIds.fullArticle}
        >
          {fullArticleLabel}
          <StrokeIcon name="openOut" size={13} />
        </a>
      ) : (
        <button
          type="button"
          className={`${styles.fullArticle} ${styles.onPage}`}
          onClick={() => onPage.show({ anchor: null, quote: source.title })}
          data-testid={articleLineLinksTestIds.fullArticle}
        >
          {fullArticleLabel}
        </button>
      )}
    </>
  );
}
