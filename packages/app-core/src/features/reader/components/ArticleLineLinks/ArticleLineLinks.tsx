import { articlePlaceUrl, articleReadMinutes, READ_ANYWAY_SECTION, sourceName, type ArticleDetails, type NoteLine, type WebSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ArticleLineLinks.module.scss";
import { articleLineLinksTestIds } from "./ArticleLineLinksTestIds.js";

export interface ArticleLineLinksProps {
  line: NoteLine;
  source: WebSource;
  article: ArticleDetails;
}

// What a line of an article's note points at: its chapter, in the slot where a video's line
// shows a timestamp, and at the end of Read it anyway the parts named and the full article
// with its cost (designs 77o, 77s–77v).
export function ArticleLineLinks({ line, source, article }: ArticleLineLinksProps) {
  if (line.chapterIndex !== undefined) {
    const chapter = article.chapters[line.chapterIndex];
    return chapter === undefined ? null : (
      <a
        className={styles.chapterLink}
        href={articlePlaceUrl(source.url, chapter.place)}
        target="_blank"
        rel="noopener"
        aria-label={`${chapter.title}, opens the article in a new tab`}
        data-testid={articleLineLinksTestIds.chapterLink}
      >
        {chapter.title}
        <StrokeIcon name="openOut" size={13} />
      </a>
    );
  }

  if (line.section !== READ_ANYWAY_SECTION || line.heading) {
    return null;
  }

  const named = (article.readAnyway?.chapterIndexes ?? []).flatMap((index) => article.chapters[index] ?? []);
  return (
    <>
      {named.length > 0 && (
        <ul className={styles.chapters}>
          {named.map((chapter) => (
            <li key={chapter.title}>
              <a
                className={styles.chapterChip}
                href={articlePlaceUrl(source.url, chapter.place)}
                target="_blank"
                rel="noopener"
                data-testid={articleLineLinksTestIds.namedChapter}
              >
                {chapter.title}
                <span className={styles.chipTime}>
                  {articleReadMinutes(chapter.wordCount)} min
                  <StrokeIcon name="openOut" size={13} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <a
        className={styles.fullArticle}
        href={source.url}
        target="_blank"
        rel="noopener"
        data-testid={articleLineLinksTestIds.fullArticle}
      >
        Read the full article on {sourceName(source)} · {articleReadMinutes(source.wordCount)} min
        <StrokeIcon name="openOut" size={13} />
      </a>
    </>
  );
}
