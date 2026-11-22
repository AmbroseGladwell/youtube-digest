import { useEffect, useRef } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import type { TranscriptionNotice as Notice, TranscriptionStopRoute } from "../../util/transcriptionCopy.js";
import styles from "./TranscriptionNotice.module.scss";
import { transcriptionNoticeTestIds } from "./TranscriptionNoticeTestIds.js";

export interface TranscriptionNoticeAction {
  label: string;
  onPress: () => void;
}

export interface TranscriptionNoticeProps {
  notice: Notice;
  primary?: TranscriptionNoticeAction | null;
  secondary?: TranscriptionNoticeAction | null;
  route?: TranscriptionStopRoute;
  foot?: string | null;
  // After Create the notice replaces the steps, so it takes focus; under a pasted link it leaves
  // focus in the field the reader is typing in.
  takeFocus?: boolean;
  onFollowed?: (() => void) | undefined;
}

// A stop or a question about transcribing an episode, in place of the action it replaces: a
// heading, what happened and what's left, and the ways that exist. Stops are alerts, and after
// Create take focus to their first action, as 95i (design 305, Notes: Accessibility).
export const TranscriptionNotice = ({
  notice,
  primary = null,
  secondary = null,
  route = null,
  foot = null,
  takeFocus = false,
  onFollowed,
}: TranscriptionNoticeProps) => {
  const first = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (takeFocus) {
      first.current?.focus();
    }
  }, [takeFocus]);
  const takeFirst = (element: HTMLElement | null) => {
    if (first.current === null) {
      first.current = element;
    }
  };
  return (
    <div className={styles.root} role="alert" data-testid={transcriptionNoticeTestIds.root}>
      <h3 className={styles.heading} data-testid={transcriptionNoticeTestIds.heading}>
        {notice.heading}
      </h3>
      <p className={styles.body} data-testid={transcriptionNoticeTestIds.body}>
        {notice.body}
      </p>
      {(primary !== null || secondary !== null || route !== null) && (
        <div className={styles.actions}>
          {primary !== null && (
            <button
              type="button"
              ref={takeFirst}
              className={styles.primary}
              onClick={primary.onPress}
              data-testid={transcriptionNoticeTestIds.primary}
            >
              {primary.label}
            </button>
          )}
          {route !== null && (
            <PageLink
              ref={takeFirst}
              className={styles.primary}
              to={Routes.settingsSection("plan")}
              onClick={onFollowed}
              data-testid={transcriptionNoticeTestIds.plans}
            >
              {route === "plus" ? "See Plus" : "See plans"}
            </PageLink>
          )}
          {secondary !== null && (
            <button
              type="button"
              ref={takeFirst}
              className={styles.secondary}
              onClick={secondary.onPress}
              data-testid={transcriptionNoticeTestIds.secondary}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {foot !== null && (
        <p className={styles.foot} data-testid={transcriptionNoticeTestIds.foot}>
          {foot}
        </p>
      )}
    </div>
  );
};
