import { useId, useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import type { RelatedOverview } from "../../util/relatedByTag.js";
import styles from "./RelatedByTag.module.scss";
import { relatedByTagTestIds } from "./RelatedByTagTestIds.js";

const SHOWN_AT_FIRST = 3;

export interface RelatedByTagProps {
  tags: string[];
  related: RelatedOverview[];
  // Where there is a library to land in. The side panel has none, so its tags are words.
  tagsLink: boolean;
  onTagFollowed?: (() => void) | undefined;
  onOverviewOpened?: ((sharedTags: number) => void) | undefined;
  onMoreShown?: ((shown: boolean) => void) | undefined;
}

// The note's last section: its tags as the heading row, each opening the library filtered to
// it, and under them the overviews sharing most of them ("OV-84 1 On the Note" 84a–84e).
export function RelatedByTag({
  tags,
  related,
  tagsLink,
  onTagFollowed,
  onOverviewOpened,
  onMoreShown,
}: RelatedByTagProps) {
  const [allShown, setAllShown] = useState(false);
  const headingId = useId();
  const animateNavigation = useShouldAnimateNavigation();
  const shown = allShown ? related : related.slice(0, SHOWN_AT_FIRST);
  const hidden = related.length - SHOWN_AT_FIRST;

  if (tags.length === 0) {
    return null;
  }

  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={relatedByTagTestIds.root}>
      <h2 id={headingId} className={styles.heading} data-testid={relatedByTagTestIds.heading}>
        {related.length > 0 ? "Related by tag" : "Tags"}
      </h2>
      <TagList tags={tags} link={tagsLink} onFollowed={onTagFollowed} />
      {related.length > 0 && (
        <ul className={styles.related} aria-label="Related by tag" data-testid={relatedByTagTestIds.related}>
          {shown.map(({ overview, state, sharedTags }) => (
            <li key={overview.id}>
              <Link
                className={styles.row}
                to={Routes.overview(overview.id)}
                viewTransition={animateNavigation}
                onClick={() => onOverviewOpened?.(sharedTags)}
                data-read={state.read || undefined}
              >
                <OverviewThumbnail video={overview.video} className={styles.thumbnail} />
                <span className={styles.text}>
                  <span className={styles.title}>{overview.video.title}</span>
                  <span className={styles.meta}>
                    {overview.video.channel}
                    {state.read && " · Read"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            onMoreShown?.(!allShown);
            setAllShown(!allShown);
          }}
          aria-expanded={allShown}
          data-testid={relatedByTagTestIds.showMoreButton}
        >
          {allShown ? "Show fewer" : `Show ${hidden} more`}
          <StrokeIcon name={allShown ? "chevronUp" : "chevronDown"} />
        </button>
      )}
    </section>
  );
}

function TagList({ tags, link, onFollowed }: { tags: string[]; link: boolean; onFollowed?: (() => void) | undefined }) {
  const animateNavigation = useShouldAnimateNavigation();
  return (
    <ul className={styles.tags} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          {link ? (
            <Link
              className={styles.tagLink}
              to={Routes.taggedLibrary(tag)}
              viewTransition={animateNavigation}
              onClick={onFollowed}
              aria-label={`Show overviews tagged ${tag}`}
              data-testid={relatedByTagTestIds.tag(tag)}
            >
              #{tag}
            </Link>
          ) : (
            <span className={styles.tagWord} data-testid={relatedByTagTestIds.tag(tag)}>
              #{tag}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
