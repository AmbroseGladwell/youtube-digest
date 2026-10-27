import type { ReactNode } from "react";
import { Link } from "react-router";
import { TRIAL_OVERVIEWS, type OverviewUsage } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PLAN_CARDS } from "../../planCards.js";
import { CHECKING, leftOf, resetDate } from "../../../newOverview/util/usageLine.js";
import styles from "./PlanUsage.module.scss";
import { planUsageTestIds } from "./PlanUsageTestIds.js";

type Usage = { status: "checking" | "unreachable" } | { status: "known"; data: OverviewUsage };

export type PlanUsageProps =
  | { signedIn: true; usage: Usage; hasOwnKey: boolean }
  | { signedIn: false; trialMade: number };

interface Cell {
  id: "ours" | "own" | "trial";
  label: string;
  count: string;
  aside?: ReactNode;
}

const FREE = PLAN_CARDS[0]!;
const FREE_ACCOUNT = `A free account makes ${FREE.ourKey} on us and ${FREE.ownKey} on your own key, and keeps them on every device.`;

// This month's counts above the plan cards (designs 95d–95h): one cell per quota on an
// account, and the trial's one count signed out, which covers either key (decided on OV-131).
export function PlanUsage(props: PlanUsageProps) {
  if (!props.signedIn) {
    return (
      <div className={styles.root} data-testid={planUsageTestIds.root}>
        <p className={styles.period} data-testid={planUsageTestIds.period}>
          This device only
        </p>
        <Cells
          cells={[
            {
              id: "trial",
              label: "Trial overviews",
              count: leftOf(Math.max(0, TRIAL_OVERVIEWS - props.trialMade), TRIAL_OVERVIEWS),
              aside: "On either key. They don't reset.",
            },
          ]}
        />
        <p className={styles.note}>{FREE_ACCOUNT}</p>
        <Link className={styles.createAccount} to={Routes.createAccount()} data-testid={planUsageTestIds.createAccountLink}>
          Create account
        </Link>
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
            <Link className={styles.link} to={Routes.settingsSection("keys")} data-testid={planUsageTestIds.addKeyLink}>
              Add a key
            </Link>
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
        ]}
      />
    </div>
  );
}

function Cells({ cells }: { cells: Cell[] }) {
  return (
    <dl className={styles.cells}>
      {cells.map((cell) => (
        <div className={styles.cell} key={cell.id} data-testid={planUsageTestIds.cell(cell.id)}>
          <dt>{cell.label}</dt>
          <dd className={styles.count}>{cell.count}</dd>
          {cell.aside !== undefined && <dd className={styles.aside}>{cell.aside}</dd>}
        </div>
      ))}
    </dl>
  );
}
