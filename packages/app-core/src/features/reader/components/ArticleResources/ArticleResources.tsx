import { useId, useState, type CSSProperties } from "react";
import {
  articlePlaceUrl,
  RESOURCES_SECTION,
  sourceName,
  type ArticleDetails,
  type ArticleResource,
  type WebSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ShowOnPage } from "../../useShowOnPage.js";
import styles from "./ArticleResources.module.scss";
import { articleResourcesTestIds } from "./ArticleResourcesTestIds.js";

export interface ArticleResourcesProps {
  source: WebSource;
  article: ArticleDetails;
  // Beside the article "From" moves the page and drops the arrow, as chapter links do (203l).
  onPage: ShowOnPage | null;
  // The panel and a phone set the names and whys one size down (203l–203n).
  compact: boolean;
}

const PREVIEW_NAMES = 2;

const siteOf = (href: string): string => new URL(href).hostname.replace(/^www\./, "");

export function resourcesPreview(resources: readonly ArticleResource[]): string {
  const names = resources.slice(0, PREVIEW_NAMES).map(({ text }) => text);
  const more = resources.length - names.length;
  if (more > 0) return `${names.join(", ")} and ${more} more`;
  return names.join(" and ");
}

function explanation(source: WebSource, oneChapter: boolean, beside: boolean, several: boolean): string {
  const names = several ? "Names open the resource in a new tab." : "The name opens it in a new tab.";
  if (oneChapter) return `${names} “Where the article shares it” opens the article on ${sourceName(source)} at that place.`;
  if (beside)
    return `${several ? "Names open" : "The name opens"} in a new tab. “From” links move the article beside this panel to the place it was shared.`;
  return `${names} “From” links open the article on ${sourceName(source)} at the place it was shared.`;
}

// The links the piece points to, last in the note and closed to start (designs 203a–203n). The
// heading row is the one control; closed, a line names the first two so there's a reason to open it.
export function ArticleResources({ source, article, onPage, compact }: ArticleResourcesProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const resources = article.resources ?? [];
  if (resources.length === 0) return null;

  const several = resources.length > 1;
  const oneChapter = article.chapters.length === 1;
  const heading = several ? RESOURCES_SECTION : "A resource it points to";

  return (
    <section
      className={[styles.root, open && styles.open, compact && styles.compact].filter(Boolean).join(" ")}
      aria-labelledby={`${listId}-heading`}
      data-testid={articleResourcesTestIds.root}
    >
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        data-testid={articleResourcesTestIds.toggle}
      >
        <span className={styles.heading} id={`${listId}-heading`}>
          {heading}
          <span className={styles.count}> · {resources.length}</span>
        </span>
        <span className={styles.end}>
          {open && several && <span className={styles.order}>Most useful first</span>}
          <span className={styles.chevron}>
            <StrokeIcon name="chevronDown" size={16} />
          </span>
        </span>
      </button>
      <div className={styles.previewWrap} aria-hidden={open}>
        <div>
          <p className={styles.preview} data-testid={articleResourcesTestIds.preview}>
            {resourcesPreview(resources)}
          </p>
        </div>
      </div>
      <div className={styles.bodyWrap}>
        <div id={listId} inert={!open} aria-hidden={!open}>
          <p className={styles.explanation} style={{ "--i": 0 } as CSSProperties}>
            {explanation(source, oneChapter, onPage !== null, several)}
          </p>
          <ul className={styles.list} aria-labelledby={`${listId}-heading`} data-testid={articleResourcesTestIds.list}>
            {resources.map((resource, index) => (
              <ResourceItem key={resource.href} resource={resource} index={index} source={source} article={article} onPage={onPage} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

interface ResourceItemProps {
  resource: ArticleResource;
  index: number;
  source: WebSource;
  article: ArticleDetails;
  onPage: ShowOnPage | null;
}

function ResourceItem({ resource, index, source, article, onPage }: ResourceItemProps) {
  const site = siteOf(resource.href);
  const chapter = article.chapters.length === 1 ? null : (article.chapters[resource.chapter]?.title ?? null);
  const fromLabel =
    chapter === null
      ? onPage === null
        ? "Where the article shares it: opens the article at that place"
        : "Where the article shares it: moves the article beside this panel to that place"
      : onPage === null
        ? `From ${chapter}: opens the article at the place it was shared`
        : `From ${chapter}: moves the article beside this panel to the place it was shared`;
  const fromText =
    chapter === null ? (
      <b>Where the article shares it</b>
    ) : (
      <>
        From <b>{chapter}</b>
      </>
    );

  return (
    <li className={styles.item} style={{ "--i": index + 1 } as CSSProperties} data-testid={articleResourcesTestIds.item}>
      <span className={styles.site}>{site}</span>
      <a
        className={styles.name}
        href={resource.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${resource.text}, on ${site}, opens in a new tab`}
        data-testid={articleResourcesTestIds.name}
      >
        {resource.text}
        <StrokeIcon name="openOut" size={13} />
      </a>
      <p className={styles.why} data-testid={articleResourcesTestIds.why}>
        {resource.why}
      </p>
      {onPage === null ? (
        <a
          className={styles.from}
          href={articlePlaceUrl(source.url, resource.place)}
          target="_blank"
          rel="noopener"
          aria-label={fromLabel}
          data-testid={articleResourcesTestIds.from}
        >
          {fromText}
          <StrokeIcon name="openOut" size={13} />
        </a>
      ) : (
        <button
          type="button"
          className={`${styles.from} ${styles.onPage}`}
          onClick={() => onPage.show(resource.place)}
          aria-label={fromLabel}
          data-testid={articleResourcesTestIds.from}
        >
          {fromText}
        </button>
      )}
    </li>
  );
}
