import type { ReactNode } from "react";
import type { OverviewUsage, TranscriptionUsage } from "@overview/domain";
import { audioLength } from "../../../podcasts/util/transcriptionCopy.js";
import { Routes } from "../../../../app/Routes.js";
import { PLAN_CARDS } from "../../planCards.js";
import { CHECKING, leftOf, resetDate } from "../../../newOverview/util/usageLine.js";
import styles from "./PlanUsage.module.scss";
import { planUsageTestIds } from "./PlanUsageTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

type Usage = { status: "checking" | "unreachable" } | { status: "known"; data: OverviewUsage };

export type PlanUsageProps = { signedIn: true; usage: Usage; hasOwnKey: boolean } | { signedIn: false };

interface Cell {
  id: "ours" | "own" | "transcribing";
  label: string;
  count: string;
  aside?: ReactNode;
  // Beside the label, as the transcribing row's episodes are (design 305m).
  tally?: string;
  wide?: boolean;
}

const FREE = PLAN_CARDS[0]!;
const FREE_ACCOUNT = `A free account makes ${FREE.ourKey} on us and ${FREE.ownKey} on your own key, and keeps them on every device.`;

// This month's counts above the plan cards (designs 95d–95h): one cell per quota on an
// account. Signed out there is nothing to count, since overviews need an account
// (docs/architecture/tiers.md, "Signed out"), so it offers one.
export function PlanUsage(props: PlanUsageProps) {
  if (!props.signedIn) {
    return (
      <div className={styles.root} data-testid={planUsageTestIds.root}>
        <p className={styles.note}>{FREE_ACCOUNT}</p>
        <PageLink className={styles.createAccount} to={Routes.createAccount()} data-testid={planUsageTestIds.createAccountLink}>
          Create account
        </PageLink>
      </div>
    );
  }

  const { usage, hasOwnKey } = props;
  const countOf = (key: "ours" | "own"): Pick<Cell, "count" | "aside"> => {
    if (usage.status !== "known") return { count: usage.status === "checking" ? CHECKING : "Couldn't check" };
    const { used, limit } = usage.data[key];
    if (key === "own" && !hasOwnKey) {
      return {
        count: `${limit} a month`,
        aside: (
          <>
            Once you add a key ·{" "}
            <PageLink className={styles.link} to={Routes.settingsSection("keys")} data-testid={planUsageTestIds.addKeyLink}>
              Add a key
            </PageLink>
          </>
        ),
      };
    }
    const left = Math.max(0, limit - used);
    return {
      count: leftOf(left, limit),
      aside: left === 0 ? `None left. More on ${resetDate(usage.data.resetsOn)}.` : undefined,
    };
  };

  return (
    <div className={styles.root} data-testid={planUsageTestIds.root}>
      <p className={styles.period} data-testid={planUsageTestIds.period}>
        {usage.status === "known" ? `This month · resets ${resetDate(usage.data.resetsOn)}` : "This month"}
      </p>
      <Cells
        cells={[
          { id: "ours", label: "On us", ...countOf("ours") },
          { id: "own", label: "On your own key", ...countOf("own") },
          ...(usage.status === "known" && usage.data.transcription !== undefined
            ? [transcribingCell(usage.data.transcription, usage.data.resetsOn)]
            : []),
        ]}
      />
    </div>
  );
}

// Design 305m: transcribing as its own full-width row under the overviews, counted in hours and
// minutes of audio, with the episodes it went on and a line on what it's for.
const transcribingCell = (transcription: TranscriptionUsage, resetsOn: string): Cell => {
  const left = Math.max(0, transcription.limitSeconds - transcription.usedSeconds);
  return {
    id: "transcribing",
    label: "Transcribing",
    count: `${audioLength(left)} of ${audioLength(transcription.limitSeconds)} left`,
    tally: transcription.episodes === 1 ? "1 episode" : `${transcription.episodes} episodes`,
    aside:
      left === 0
        ? `None left. More on ${resetDate(resetsOn)}.`
        : "Episodes with no transcript are made from their audio. Ones you’ve transcribed before are free.",
    wide: true,
  };
};

function Cells({ cells }: { cells: Cell[] }) {
  return (
    <dl className={styles.cells}>
      {cells.map((cell) => (
        <div
          className={cell.wide === true ? `${styles.cell} ${styles.wide}` : styles.cell}
          key={cell.id}
          data-testid={planUsageTestIds.cell(cell.id)}
        >
          <dt className={styles.label}>
            {cell.label}
            {cell.tally !== undefined && <span className={styles.tally}>{cell.tally}</span>}
          </dt>
          <dd className={styles.count}>{cell.count}</dd>
          {cell.aside !== undefined && <dd className={styles.aside}>{cell.aside}</dd>}
        </div>
      ))}
    </dl>
  );
}
