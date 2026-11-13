import { useRef, useState } from "react";
import { openPodcastLabel, sourceUrl as linkOf, type OverviewMenuItem, type Source } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import type { OverviewInWebApp } from "../../../sync/useOverviewInWebApp.js";
import styles from "./OverviewActionsMenu.module.scss";
import { overviewActionsMenuTestIds } from "./OverviewActionsMenuTestIds.js";

export interface OverviewActionsMenuProps {
  topicCount: number;
  hasReason: boolean;
  read: boolean;
  source: Source;
  // Recipes only (design 144r): the page's recipe as it stands on screen, with its source.
  recipe: { onCopy: () => void; onPrint: () => void } | null;
  // Absent where there is no account to share under, which is how the item hides itself
  // rather than offering a control that cannot work (docs/features/sharing.md).
  onShare: (() => void) | null;
  // Articles only (design 13). A note we can't remake right here says so in its label, by
  // the ellipsis, and explains before anything happens.
  regenerate: { asksFirst: boolean; onChoose: () => void } | null;
  // Design 6h: the panel's menu offers the web app instead of read state and deletion.
  compact: boolean;
  webApp: OverviewInWebApp;
  onEditTopics: () => void;
  onEditReason: () => void;
  onToggleRead: () => void;
  // Null where there is no library to keep projects in; otherwise how many it's in (168r).
  projects: { count: number; onAdd: () => void } | null;
  onDelete: () => void;
}

interface WayOut {
  open: OverviewMenuItem;
  openLabel: string;
  copy: OverviewMenuItem;
  copyLabel: string;
}

// The way back to the source, in its own words. An episode's goes where the reader came from:
// "Listen on Spotify", and the link copied is that one too (design 106n).
function wayOut(source: Source, recipe: boolean): WayOut {
  if (source.kind === "podcast") {
    return { open: "openEpisode", openLabel: openPodcastLabel(source.sharedFrom), copy: "copyEpisodeLink", copyLabel: "Copy episode link" };
  }
  if (source.kind === "web") {
    return {
      open: "readArticle",
      openLabel: recipe ? "Open the recipe" : "Read the article",
      copy: "copyArticleLink",
      copyLabel: recipe ? "Copy recipe link" : "Copy article link",
    };
  }
  return {
    open: "watchOnYouTube",
    openLabel: recipe ? "Open the recipe" : "Watch on YouTube",
    copy: "copyYouTubeLink",
    copyLabel: recipe ? "Copy recipe link" : "Copy YouTube link",
  };
}

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

// Design 4b/6h: everything about the note that is not reading it.
export function OverviewActionsMenu({
  topicCount,
  hasReason,
  read,
  source,
  recipe,
  compact,
  webApp,
  onShare,
  regenerate,
  onEditTopics,
  onEditReason,
  onToggleRead,
  projects,
  onDelete,
}: OverviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const analytics = useReaderAnalytics();
  const sourceUrl = linkOf(source);
  const way = wayOut(source, recipe !== null);

  const close = () => {
    analytics.actionsMenu.closed();
    setOpen(false);
  };

  useDismissOnOutside(open, close, root);

  const choose = (item: OverviewMenuItem, action: () => void) => () => {
    analytics.actionsMenu.itemChosen({ item });
    setOpen(false);
    action();
  };

  return (
    <div className={styles.root} ref={root} data-testid={overviewActionsMenuTestIds.root}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          analytics.actionsMenu.opened();
          setOpen(true);
        }}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={overviewActionsMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={16} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" data-testid={overviewActionsMenuTestIds.menu}>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("editTopics", onEditTopics)}
            data-testid={overviewActionsMenuTestIds.editTopicsItem}
          >
            Edit topics
            <span className={styles.count} data-testid={overviewActionsMenuTestIds.topicCount}>
              {topicCount}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("editReason", onEditReason)}
            data-testid={overviewActionsMenuTestIds.reasonItem}
          >
            {hasReason ? "Edit reason" : "Add reason"}
          </button>
          {regenerate !== null && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("regenerate", regenerate.onChoose)}
              data-testid={overviewActionsMenuTestIds.regenerateItem}
            >
              {regenerate.asksFirst ? "Regenerate…" : "Regenerate"}
            </button>
          )}
          {projects !== null && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("addToProject", projects.onAdd)}
              data-testid={overviewActionsMenuTestIds.addToProjectItem}
            >
              Add to project…
              {projects.count > 0 && (
                <span className={styles.count} data-testid={overviewActionsMenuTestIds.projectCount}>
                  In {projects.count}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("toggleRead", onToggleRead)}
            data-testid={overviewActionsMenuTestIds.readItem}
          >
            {read ? "Mark as unread" : "Mark as read"}
          </button>
          {onShare !== null && (
            <>
              <span className={styles.rule} aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemStandout}`}
                onClick={choose("share", onShare)}
                data-testid={overviewActionsMenuTestIds.shareItem}
              >
                Share…
                <StrokeIcon name="share" size={16} />
              </button>
            </>
          )}
          {recipe !== null && (
            <>
              {canWriteClipboard() && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={choose("copyRecipe", recipe.onCopy)}
                  data-testid={overviewActionsMenuTestIds.copyRecipeItem}
                >
                  Copy recipe
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={choose("printRecipe", recipe.onPrint)}
                data-testid={overviewActionsMenuTestIds.printRecipeItem}
              >
                Print recipe
              </button>
            </>
          )}
          <a
            role="menuitem"
            className={styles.item}
            href={sourceUrl}
            target="_blank"
            rel="noopener"
            onClick={choose(way.open, () => undefined)}
            data-testid={overviewActionsMenuTestIds.watchItem}
          >
            {way.openLabel}
          </a>
          {canWriteClipboard() && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose(way.copy, () => void navigator.clipboard.writeText(sourceUrl))}
              data-testid={overviewActionsMenuTestIds.copyLinkItem}
            >
              {way.copyLabel}
            </button>
          )}
          {/* Design 6h: only the panel has a web app elsewhere to open the note in, and
              design 205b-2 ends the panel's menu with Delete as the phone's does, so in the
              panel both are here and Delete is last either way. */}
          {compact &&
            webApp !== null &&
            ("href" in webApp ? (
              <a
                role="menuitem"
                className={styles.item}
                href={webApp.href}
                target="_blank"
                rel="noopener"
                onClick={choose("openInWebApp", () => undefined)}
                data-testid={overviewActionsMenuTestIds.openInWebItem}
              >
                Open in web app
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemWithReason}`}
                disabled
                data-testid={overviewActionsMenuTestIds.openInWebItem}
              >
                Open in web app
                <span className={styles.reason} data-testid={overviewActionsMenuTestIds.openInWebReason}>
                  {webApp.reason}
                </span>
              </button>
            ))}
          <button
            type="button"
            role="menuitem"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={choose("delete", onDelete)}
            data-testid={overviewActionsMenuTestIds.deleteItem}
          >
            Delete overview
          </button>
        </div>
      )}
    </div>
  );
}
