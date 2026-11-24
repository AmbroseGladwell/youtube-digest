import { useRef, useState } from "react";
import {
  clipPlatformName,
  isClipSource,
  openPodcastLabel,
  sourceUrl as linkOf,
  type OverviewMenuItem,
  type Source,
  isWrittenPost,
} from "@overview/domain";
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
  recipe: { onCopy: () => void; onPrint: () => void } | null;
  // Null with no account to share under, so the item hides rather than offering a dead control.
  onShare: (() => void) | null;
  regenerate: { asksFirst: boolean; onChoose: () => void } | null;
  compact: boolean;
  webApp: OverviewInWebApp;
  onEditTopics: () => void;
  onEditReason: () => void;
  onToggleRead: () => void;
  // Null when signed out, with no library to keep projects in.
  projects: { count: number; onAdd: () => void } | null;
  onDelete: () => void;
  onChat?: (() => void) | null;
  // Null when signed out: feedback needs an account (OV-185).
  onFeedback?: ((returnFocusTo: HTMLElement | null) => void) | null;
}

interface WayOut {
  open: OverviewMenuItem;
  openLabel: string;
  copy: OverviewMenuItem;
  copyLabel: string;
}

const OPEN_RECIPE = "Open the recipe";
const COPY_RECIPE_LINK = "Copy recipe link";

const wayOut = (source: Source, recipe: boolean): WayOut => {
  if (source.kind === "podcast") {
    return { open: "openEpisode", openLabel: openPodcastLabel(source.sharedFrom), copy: "copyEpisodeLink", copyLabel: "Copy episode link" };
  }
  if (source.kind === "web") {
    return {
      open: "readArticle",
      openLabel: recipe ? OPEN_RECIPE : "Read the article",
      copy: "copyArticleLink",
      copyLabel: recipe ? COPY_RECIPE_LINK : "Copy article link",
    };
  }
  const platform = isClipSource(source) ? clipPlatformName(source) : "YouTube";
  return {
    open: "watchOnYouTube",
    openLabel: recipe ? OPEN_RECIPE : `${isWrittenPost(source) ? "Open" : "Watch"} on ${platform}`,
    copy: "copyYouTubeLink",
    copyLabel: recipe ? COPY_RECIPE_LINK : `Copy ${platform} link`,
  };
};

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

export const OverviewActionsMenu = ({
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
  onChat = null,
  onFeedback = null,
}: OverviewActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
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
        ref={trigger}
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
          {onChat !== null && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("chat", () => {
                trigger.current?.focus({ preventScroll: true });
                onChat();
              })}
              data-testid={overviewActionsMenuTestIds.chatItem}
            >
              Chat
            </button>
          )}
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
          {onFeedback !== null && (
            <>
              <span className={styles.rule} aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={choose("sendFeedback", () => onFeedback(trigger.current))}
                data-testid={overviewActionsMenuTestIds.feedbackItem}
              >
                Send feedback
                <StrokeIcon name="chat" size={16} />
              </button>
            </>
          )}
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
};
