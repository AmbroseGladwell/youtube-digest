import { useEffect, useRef, useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { useReadAloud, useReadAloudSnapshot } from "../../readAloud/ReadAloudContext.js";
import { sameAnswer, type AnswerRef, type ReadAloudMeta } from "../../readAloud/ReadAloudEngine.js";
import styles from "./ReadAloudControl.module.scss";
import { readAloudControlTestIds } from "./ReadAloudControlTestIds.js";

export interface ReadAloudProblemProps {
  answer: AnswerRef;
  about: Omit<ReadAloudMeta, "control">;
  monthWaitShown: boolean;
  offerPlans: boolean;
  onPlansFollowed: () => void;
}

const announcementOf = (was: string, now: string): string | null => {
  if (was === "idle" && now !== "idle") {
    return "Reading aloud";
  }
  return was !== "idle" && now === "idle" ? "Stopped reading" : null;
};

// What went wrong, under the row of the answer it went wrong on (design 418h to 418h-3).
export const ReadAloudProblem = ({ answer, about, monthWaitShown, offerPlans, onPlansFollowed }: ReadAloudProblemProps) => {
  const engine = useReadAloud();
  const snapshot = useReadAloudSnapshot();
  const status = snapshot !== null && sameAnswer(snapshot.answer, answer) ? snapshot.status : "idle";
  const held = snapshot?.problem ?? null;
  const problem = held !== null && sameAnswer(held.answer, answer) ? held.problem : null;
  const [announcement, setAnnouncement] = useState("");
  const was = useRef(status);
  useEffect(() => {
    const said = announcementOf(was.current, status);
    was.current = status;
    if (said !== null) {
      setAnnouncement(said);
    }
  }, [status]);
  useEffect(() => {
    if (problem?.kind === "failed") {
      setAnnouncement("Couldn't read this aloud");
    }
  }, [problem]);

  if (engine === null) {
    return null;
  }
  return (
    <>
      {problem?.kind === "failed" && (
        <p className={styles.line} data-testid={readAloudControlTestIds.problem}>
          Couldn’t read this aloud.{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => engine.press(answer, { ...about, control: "bottom" })}
            data-testid={readAloudControlTestIds.tryAgain}
          >
            Try again
          </button>
        </p>
      )}
      {problem?.kind === "spent" && problem.quota === "month" && monthWaitShown && (
        <p className={styles.line} data-testid={readAloudControlTestIds.problem}>
          Listening is back on {problem.resetsOn === null ? "the 1st" : resetDate(problem.resetsOn)}, with your chat.
        </p>
      )}
      {problem?.kind === "spent" && !(problem.quota === "month" && monthWaitShown) && (
        <div className={styles.card} data-testid={readAloudControlTestIds.problem}>
          <p className={styles.cardTitle}>Not enough chat left to read this aloud</p>
          <p className={styles.cardText}>
            {problem.quota === "day" || problem.resetsOn === null ? "More tomorrow." : `More on ${resetDate(problem.resetsOn)}.`}
            {offerPlans && problem.quota === "month" && (
              <>
                {" "}
                <PageLink
                  className={styles.link}
                  to={Routes.settingsSection("plan")}
                  onClick={onPlansFollowed}
                  data-testid={readAloudControlTestIds.seePlans}
                >
                  See plans
                </PageLink>
              </>
            )}
          </p>
        </div>
      )}
      <span className={styles.live} aria-live="polite" data-testid={readAloudControlTestIds.live}>
        {announcement}
      </span>
    </>
  );
};
