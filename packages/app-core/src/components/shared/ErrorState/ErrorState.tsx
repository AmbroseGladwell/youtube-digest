import { useCallback, type ReactNode } from "react";
import type { ErrorScreen } from "@overview/domain";
import { isSyncRequestError, isSyncTransportError } from "@overview/sync";
import { Routes } from "../../../app/Routes.js";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { useAnalytics } from "../../../features/analytics/AnalyticsContext.js";
import { useReportError } from "../../../features/errors/useReportError.js";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./ErrorState.module.scss";
import { errorStateTestIds } from "./ErrorStateTestIds.js";
import { PageLink } from "../PageLink/PageLink.js";

// A departure takes the pill too: leaving for the video is an action, not navigation.
export type ErrorStateAction = { label: string; onSelect: () => void } | { label: string; href: string };

export interface ErrorStateProps {
  // For counting what readers do on this dead end; the title is copy.
  screen: ErrorScreen;
  title: string;
  body?: ReactNode;
  action?: ErrorStateAction | undefined;
  back?: boolean | undefined;
  // Reported once.
  error?: unknown;
}

// Which actions a case offers is the caller's to say: offering the wrong one is the harm this screen avoids.
export const ErrorState = ({ screen, title, body, action, back = false, error }: ErrorStateProps) => {
  const isPanel = useIsPanel();
  const analytics = useAnalytics();
  useReportError(error, isSyncRequestError(error) || isSyncTransportError(error) ? "failedRequest" : "errorState");
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
                onClick={() => analytics.app.errorState.actionChosen({ screen })}
                data-testid={errorStateTestIds.action}
              >
                {action.label}
              </a>
            ) : (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  analytics.app.errorState.actionChosen({ screen });
                  action.onSelect();
                }}
                data-testid={errorStateTestIds.action}
              >
                {action.label}
              </button>
            ))}
          {back && (
            <PageLink
              to={Routes.home()}
              className={styles.back}
              onClick={() => analytics.app.errorState.backChosen({ screen })}
              data-testid={errorStateTestIds.back}
            >
              <StrokeIcon name="arrowLeft" /> {isPanel ? "Back" : "All overviews"}
            </PageLink>
          )}
        </div>
      )}
    </div>
  );
};
