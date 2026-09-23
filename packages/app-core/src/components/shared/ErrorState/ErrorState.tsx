import { useCallback, type ReactNode } from "react";
import { Link } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { useIsPanel } from "../../../app/LayoutContext.js";
import styles from "./ErrorState.module.scss";
import { errorStateTestIds } from "./ErrorStateTestIds.js";

// A recovery action does something here; a departure leaves the app entirely. Both take
// the pill, because the distinction the screen is built on is between an action and
// navigation, and leaving for the video is an action (docs/features/record-migrations.md).
export type ErrorStateAction =
  | { label: string; onSelect: () => void }
  | { label: string; href: string };

export interface ErrorStateProps {
  title: string;
  body?: ReactNode;
  action?: ErrorStateAction | undefined;
  back?: boolean | undefined;
}

// Design turn 19's one dead-end screen. A recovery action is a pill and navigation is the
// back link the rest of the app already uses, so the two are never mistaken for each
// other and a one-action screen doesn't read as having lost its pair. Which actions a
// case offers is the caller's to say, because offering the wrong one is the harm this
// screen exists to avoid (docs/features/error-state.md).
export function ErrorState({ title, body, action, back = false }: ErrorStateProps) {
  const isPanel = useIsPanel();
  const focusOnMount = useCallback((element: HTMLElement | null) => element?.focus(), []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      ref={focusOnMount}
      className={`${styles.root} ${isPanel ? styles.panel : ""}`}
      data-testid={errorStateTestIds.root}
    >
      <span className={styles.rule} aria-hidden="true" />
      <h2 className={styles.title} data-testid={errorStateTestIds.title}>
        {title}
      </h2>
      {body !== undefined && (
        <p className={styles.body} data-testid={errorStateTestIds.body}>
          {body}
        </p>
      )}
      {(action !== undefined || back) && (
        <div className={styles.actions}>
          {action !== undefined &&
            ("href" in action ? (
              <a
                className={styles.action}
                href={action.href}
                target="_blank"
                rel="noreferrer"
                data-testid={errorStateTestIds.action}
              >
                {action.label}
              </a>
            ) : (
              <button
                type="button"
                className={styles.action}
                onClick={action.onSelect}
                data-testid={errorStateTestIds.action}
              >
                {action.label}
              </button>
            ))}
          {back && (
            <Link
              to={Routes.home()}
              className={styles.back}
              data-testid={errorStateTestIds.back}
            >
              {isPanel ? "← Back" : "← All overviews"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
