import { useRef } from "react";
import { domainOf, type CaptureSurface, type KeptCapture } from "@overview/domain";
import { Toast } from "../../../../components/shared/Toast/Toast.js";
import { useToast } from "../../../../components/shared/Toast/useToast.js";
import { usePendingRemovals } from "../../usePendingRemovals.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { resumeTimeText } from "../../../transcripts/util/resumeTime.js";
import type { KeptLinksController } from "../../useKeptLinks.js";
import styles from "./KeptLinksSection.module.scss";
import { keptLinksSectionTestIds } from "./KeptLinksSectionTestIds.js";

const FROM: Record<CaptureSurface, string> = {
  web: "Added by you",
  phone: "From your phone",
  panel: "From the extension",
  playlist: "From a playlist",
};

const RESET_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

const continuesAt = (resumesAt: string | null | undefined): string =>
  resumesAt == null ? "Continues soon" : `Continues after ${resumeTimeText(new Date(resumesAt))}`;

const waitOf = (link: KeptCapture): string => {
  if (link.waitingFor === "extension") {
    return "Ready in the extension";
  }
  if (link.waitingFor === "reset") {
    return link.resumesAt === null ? "Waiting for the month to turn" : `Continues on ${RESET_DAY.format(new Date(link.resumesAt))}`;
  }
  return continuesAt(link.resumesAt);
};

interface RowProps {
  link: KeptCapture;
  status: string;
  onRemove?: (() => void) | undefined;
}

const Row = ({ link, status, onRemove }: RowProps) => (
  <li className={styles.row} data-testid={keptLinksSectionTestIds.row}>
    <span className={styles.icon} aria-hidden="true">
      <StrokeIcon name="link" size={14} />
    </span>
    <span className={styles.text}>
      <b className={styles.title}>{link.title ?? domainOf(link.url)}</b>
      <span className={styles.status} data-testid={keptLinksSectionTestIds.status}>
        {status} · {FROM[link.keptFrom]}
      </span>
    </span>
    {onRemove !== undefined && (
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Remove ${link.title ?? link.url}`}
        data-testid={keptLinksSectionTestIds.remove}
      >
        <StrokeIcon name="close" size={14} />
      </button>
    )}
  </li>
);

// Design 358i: the links kept from Create, grouped by what each waits for.
export interface KeptLinksSectionProps {
  controller: KeptLinksController;
}

export const KeptLinksSection = ({ controller }: KeptLinksSectionProps) => {
  const { links, making, hasExtension, remove, retry } = controller;
  const root = useRef<HTMLElement | null>(null);
  const toast = useToast();
  const { pending, removeLater } = usePendingRemovals(remove);
  const removeWithUndo = (link: KeptCapture) => {
    const undo = removeLater(link.id);
    toast.show(`Removed “${link.title ?? domainOf(link.url)}”.`, true, undo);
    root.current?.focus();
  };
  const waiting = links.filter((link) => link.queueStatus === "waiting" && link.id !== making?.id && !pending.has(link.id));
  const onServer = waiting.filter((link) => link.waitingFor === "server");
  const onExtension = waiting.filter((link) => link.waitingFor === "extension");
  const onReset = waiting.filter((link) => link.waitingFor === "reset");
  const failed = links.filter((link) => link.queueStatus === "failed");
  const firstResume = onServer
    .map((link) => link.resumesAt)
    .filter((at): at is string => at !== null)
    .sort()[0];
  if (making === null && waiting.length === 0 && failed.length === 0 && toast.toast === null) {
    return null;
  }
  return (
    <section ref={root} tabIndex={-1} className={styles.root} aria-label="Kept links" data-testid={keptLinksSectionTestIds.root}>
      <Toast toast={toast.toast} onDismiss={toast.dismiss} />
      {making !== null && (
        <div className={styles.group} data-testid={keptLinksSectionTestIds.making}>
          <p className={styles.label}>Making now</p>
          <ul className={styles.list}>
            <Row link={making} status="Making now" />
          </ul>
        </div>
      )}
      {onServer.length > 0 && (
        <div className={styles.group} data-testid={keptLinksSectionTestIds.server}>
          <p className={styles.label}>
            {continuesAt(firstResume)} · {onServer.length}
          </p>
          <p className={styles.note}>
            Fetching from YouTube is paused on us{firstResume === undefined ? "" : ` until ${resumeTimeText(new Date(firstResume))}`}. These
            carry on then{hasExtension ? "" : ", or now in the extension on a computer"}.
          </p>
          <ul className={styles.list}>
            {onServer.map((link) => (
              <Row key={link.id} link={link} status={waitOf(link)} onRemove={() => removeWithUndo(link)} />
            ))}
          </ul>
        </div>
      )}
      {onExtension.length > 0 && (
        <div className={styles.group} data-testid={keptLinksSectionTestIds.extension}>
          <p className={styles.label}>Ready in the extension · {onExtension.length}</p>
          <p className={styles.note}>Only the extension can read these right now. Open it on a computer and it makes them there.</p>
          <ul className={styles.list}>
            {onExtension.map((link) => (
              <Row key={link.id} link={link} status={waitOf(link)} onRemove={() => removeWithUndo(link)} />
            ))}
          </ul>
        </div>
      )}
      {onReset.length > 0 && (
        <div className={styles.group}>
          <p className={styles.label}>Waiting for this month’s overviews · {onReset.length}</p>
          <ul className={styles.list}>
            {onReset.map((link) => (
              <Row key={link.id} link={link} status={waitOf(link)} onRemove={() => removeWithUndo(link)} />
            ))}
          </ul>
        </div>
      )}
      {failed.length > 0 && (
        <div className={styles.group} data-testid={keptLinksSectionTestIds.attention}>
          <p className={styles.label}>Needs attention · {failed.length}</p>
          <ul className={styles.list}>
            {failed.map((link) => (
              <li key={link.id} className={styles.attention}>
                <ul className={styles.list}>
                  <Row link={link} status="Failed" />
                </ul>
                <p className={styles.note}>It couldn’t be made, so nothing was used.</p>
                <span className={styles.actions}>
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => retry(link.id)}
                    data-testid={keptLinksSectionTestIds.retry}
                  >
                    Try again
                  </button>
                  <button type="button" className={styles.action} onClick={() => remove(link.id)}>
                    Dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
