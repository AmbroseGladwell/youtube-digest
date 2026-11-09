import { useEffect, useRef, useState } from "react";
import { learnedItemKey, unnoticedLearnedItems, type LearnedItems } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./LearnedNotice.module.scss";
import { learnedNoticeTestIds } from "./LearnedNoticeTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

const SHOWN_MS = 10_000;
const UNDONE_SHOWN_MS = 4_000;

// Design 141n: on the library only, so it can never cover a note or the read-along. Each item
// has its own Undo, and an undone item is remembered as removed. Nothing joins the profile
// unseen, because an item stays unnoticed until the reader has been shown it.
export function LearnedNotice() {
  const learned = useSettingsQuery().data?.learned ?? {};
  const items = unnoticedLearnedItems(learned);
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const [undone, setUndone] = useState(false);
  const [held, setHeld] = useState(false);
  const counted = useRef(0);
  const shown = items.length;

  const stamp = (field: "noticedAt" | "removedAt", texts: readonly string[]) => {
    const at = new Date().toISOString();
    const patch: LearnedItems = {};
    for (const text of texts) {
      const key = learnedItemKey(text);
      const item = learned[key];
      if (item !== undefined) patch[key] = { ...item, noticedAt: at, ...(field === "removedAt" ? { removedAt: at } : {}) };
    }
    updateSettings.mutate({ learned: patch });
  };
  const texts = items.map(({ text }) => text).join("\n");
  const noticeAll = () =>
    stamp(
      "noticedAt",
      items.map(({ text }) => text),
    );

  useEffect(() => {
    if (shown > 0 && counted.current !== shown) {
      counted.current = shown;
      analytics.settings.personalisation.learnedNoticeShown({ items: shown });
    }
  }, [shown, analytics]);

  useEffect(() => {
    if (undone) {
      const timer = window.setTimeout(() => setUndone(false), UNDONE_SHOWN_MS);
      return () => window.clearTimeout(timer);
    }
    if (shown === 0 || held) return;
    const timer = window.setTimeout(noticeAll, SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [texts, held, undone]);

  if (undone && shown === 0) {
    return (
      <div className={styles.root} role="status" data-testid={learnedNoticeTestIds.root}>
        <div className={styles.top}>
          <span className={styles.head}>Removed. We won't add it again.</span>
        </div>
      </div>
    );
  }
  if (shown === 0) return null;

  const one = items.length === 1;
  const undo = (text: string) => {
    analytics.settings.personalisation.learnedItemUndone();
    stamp("removedAt", [text]);
    setUndone(true);
  };

  return (
    <div
      className={styles.root}
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      data-testid={learnedNoticeTestIds.root}
    >
      <div className={styles.top}>
        <span className={styles.body}>
          <span className={styles.head}>
            {one ? "Added to what we know about you" : `Added ${items.length} things to what we know about you`}
          </span>
          {one ? (
            <span className={styles.one} data-testid={learnedNoticeTestIds.item(items[0]!.text)}>
              {items[0]!.text}
            </span>
          ) : (
            <ul className={styles.list}>
              {items.map(({ text }) => (
                <li key={text} className={styles.row} data-testid={learnedNoticeTestIds.item(text)}>
                  <span className={styles.rowText}>{text}</span>
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={`Undo: ${text}`}
                    onClick={() => undo(text)}
                    data-testid={learnedNoticeTestIds.undo(text)}
                  >
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </span>
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss"
          onClick={noticeAll}
          data-testid={learnedNoticeTestIds.dismiss}
        >
          <StrokeIcon name="close" size={16} />
        </button>
      </div>
      <div className={styles.actions}>
        {one && (
          <button
            type="button"
            className={styles.action}
            aria-label={`Undo: ${items[0]!.text}`}
            onClick={() => undo(items[0]!.text)}
            data-testid={learnedNoticeTestIds.undo(items[0]!.text)}
          >
            Undo
          </button>
        )}
        <PageLink
          className={styles.action}
          to={Routes.settingsSection("personalisation")}
          aria-label="See what we know about you"
          onClick={() => {
            analytics.settings.personalisation.learnedNoticeSeen();
            noticeAll();
          }}
          data-testid={learnedNoticeTestIds.see}
        >
          See
        </PageLink>
      </div>
    </div>
  );
}
