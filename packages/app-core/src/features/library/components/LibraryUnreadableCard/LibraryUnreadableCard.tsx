import type { UnreadableRecord } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import styles from "./LibraryUnreadableCard.module.scss";
import { libraryUnreadableCardTestIds } from "./LibraryUnreadableCardTestIds.js";
import type { LibraryViewState } from "../../util/libraryViewState.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface LibraryUnreadableCardProps {
  record: UnreadableRecord;
  entering?: boolean;
  onOpen: () => void;
  readerState: LibraryViewState;
}

// A sibling of LibraryOverviewCard rather than a mode of it: none of the fields that card
// is made of survive, and it carries no read or favourite control, because marking read
// something that cannot be read is absurd. It links to the reader like any other card, so
// the path needs no special case (docs/features/record-migrations.md).
export function LibraryUnreadableCard({ record, entering = false, onOpen, readerState }: LibraryUnreadableCardProps) {
  const heldBack = record.reason === "future-version";
  const readerPath = Routes.overview(record.id);

  return (
    <article
      className={`${styles.root} ${entering ? styles.entering : ""}`}
      data-entering={entering || undefined}
      data-testid={libraryUnreadableCardTestIds.root}
    >
      <p className={styles.kicker} data-testid={libraryUnreadableCardTestIds.kicker}>
        {heldBack ? "Needs a newer version" : "Older format"}
      </p>

      <PageLink
        className={styles.titleLink}
        to={readerPath}
        state={readerState}
        onClick={onOpen}
        data-testid={libraryUnreadableCardTestIds.titleLink}
      >
        <span className={styles.title}>{record.salvaged?.source?.title ?? "An overview you saved"}</span>
      </PageLink>

      <p className={styles.meta} data-testid={libraryUnreadableCardTestIds.meta}>
        {heldBack
          ? "Saved by a newer version of the app than this one. It's still here."
          : "This one couldn't be read. It's still saved, and nothing has been lost."}
      </p>
    </article>
  );
}
