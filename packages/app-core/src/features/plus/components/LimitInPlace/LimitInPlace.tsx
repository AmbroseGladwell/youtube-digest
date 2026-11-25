import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { GET_OVERVIEW_PLUS } from "../GetPlusButton/GetPlusButton.js";
import styles from "./LimitInPlace.module.scss";
import { limitInPlaceTestIds } from "./LimitInPlaceTestIds.js";

export interface LimitWaitAction {
  label: string;
  onPress: () => void;
}

export interface LimitInPlaceProps {
  heading: string;
  body: string;
  // Null for a Plus reader: there's nothing more to offer, only the wait.
  plusLine: string | null;
  onGetPlus: () => void;
  waitTitle: string;
  waitBody: string;
  waitAction?: LimitWaitAction | null;
  // Chat only; in Create the reader takes a way or closes Create.
  onNotNow?: (() => void) | null;
  notNowLabel?: string;
}

// One shape for every limit met in place: what ran out, Plus, and the wait (designs 351g, 351h, 351i).
export const LimitInPlace = ({
  heading,
  body,
  plusLine,
  onGetPlus,
  waitTitle,
  waitBody,
  waitAction = null,
  onNotNow = null,
  notNowLabel = "Not now: hide this until tomorrow",
}: LimitInPlaceProps) => (
  <div className={styles.root} role="group" aria-label={heading} data-testid={limitInPlaceTestIds.root}>
    <p className={styles.head}>
      <b data-testid={limitInPlaceTestIds.heading}>{heading}</b>
      <span>{body}</span>
    </p>
    <div className={styles.ways}>
      {plusLine !== null && (
        <div className={styles.way} data-testid={limitInPlaceTestIds.plus}>
          <span className={styles.icon} aria-hidden="true">
            <StrokeIcon name="gem" size={17} weight={1.8} />
          </span>
          <span className={styles.text}>
            <b>Plus</b>
            <small>{plusLine}</small>
          </span>
          <button type="button" className={styles.primary} onClick={onGetPlus} data-testid={limitInPlaceTestIds.getPlus}>
            {GET_OVERVIEW_PLUS}
          </button>
        </div>
      )}
      <div className={styles.way} data-testid={limitInPlaceTestIds.wait}>
        <span className={styles.icon} aria-hidden="true">
          <StrokeIcon name="clock" size={17} />
        </span>
        <span className={styles.text}>
          <b>{waitTitle}</b>
          <small>{waitBody}</small>
        </span>
        {waitAction !== null && (
          <button type="button" className={styles.secondary} onClick={waitAction.onPress} data-testid={limitInPlaceTestIds.waitAction}>
            {waitAction.label}
          </button>
        )}
      </div>
    </div>
    {onNotNow !== null && (
      <button type="button" className={styles.notNow} aria-label={notNowLabel} onClick={onNotNow} data-testid={limitInPlaceTestIds.notNow}>
        Not now
      </button>
    )}
  </div>
);
