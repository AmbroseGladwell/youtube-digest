import type { ReactNode } from "react";
import type { ChatUsage, OverviewUsage, TranscriptionUsage } from "@overview/domain";
import { audioLength } from "../../../podcasts/util/transcriptionCopy.js";
import { Routes } from "../../../../app/Routes.js";
import { PLAN_CARDS } from "../../planCards.js";
import { CHECKING, leftOf, resetDate } from "../../../newOverview/util/usageLine.js";
import { chatPercentUsed } from "../../../chats/util/chatMeterOf.js";
import styles from "./PlanUsage.module.scss";
import { planUsageTestIds, type UsageRowId } from "./PlanUsageTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

type Usage = { status: "checking" | "unreachable" } | { status: "known"; data: OverviewUsage };

export type PlanUsageProps = { signedIn: true; usage: Usage; hasOwnKey: boolean; chatUsage?: ChatUsage | null } | { signedIn: false };

interface Row {
  id: UsageRowId;
  label: string;
  tally?: string;
  count: string;
  usedPercent: number;
  aside?: ReactNode;
}

const FREE = PLAN_CARDS[0]!;
const FREE_ACCOUNT = `A free account makes ${FREE.ourKey} on us and ${FREE.ownKey} on your own key, and keeps them on every device.`;
const NEARLY_USED_UP = 90;

const percentOf = (used: number, limit: number): number => (limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)));

// Everything counted this month, each with its bar (design 351j-5).
export const PlanUsage = (props: PlanUsageProps) => {
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

  const { usage, hasOwnKey, chatUsage = null } = props;
  const keyRow = (key: "ours" | "own", label: string): Row => {
    if (usage.status !== "known") {
      return { id: key, label, count: usage.status === "checking" ? CHECKING : "Couldn't check", usedPercent: 0 };
    }
    const { used, limit } = usage.data[key];
    if (key === "own" && !hasOwnKey) {
      return {
        id: key,
        label,
        count: `${limit} a month`,
        usedPercent: 0,
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
      id: key,
      label,
      count: leftOf(left, limit),
      usedPercent: percentOf(used, limit),
      ...(left === 0 ? { aside: `None left. More on ${resetDate(usage.data.resetsOn)}.` } : {}),
    };
  };

  const known = usage.status === "known" ? usage.data : null;
  const rows: Row[] = [
    keyRow("ours", "Overviews on us"),
    keyRow("own", "On your own AI API key"),
    ...(known?.transcription !== undefined ? [transcribingRow(known.transcription, known.resetsOn)] : []),
    ...(chatUsage?.share !== undefined ? [chatRow(chatUsage.share)] : []),
    ...(known?.saves !== undefined ? [savesRow(known.saves.used, known.saves.limit)] : []),
  ];

  return (
    <div className={styles.root} data-testid={planUsageTestIds.root}>
      <p className={styles.period} data-testid={planUsageTestIds.period}>
        {known !== null ? `This month’s usage · resets ${resetDate(known.resetsOn)}` : "This month’s usage"}
      </p>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <UsageRow key={row.id} row={row} />
        ))}
      </dl>
    </div>
  );
};

const transcribingRow = (transcription: TranscriptionUsage, resetsOn: string): Row => {
  const left = Math.max(0, transcription.limitSeconds - transcription.usedSeconds);
  return {
    id: "transcribing",
    label: "Transcribing",
    tally: transcription.episodes === 1 ? "1 episode" : `${transcription.episodes} episodes`,
    count: `${audioLength(left)} of ${audioLength(transcription.limitSeconds)} left`,
    usedPercent: percentOf(transcription.usedSeconds, transcription.limitSeconds),
    ...(left === 0 ? { aside: `None left. More on ${resetDate(resetsOn)}.` } : {}),
  };
};

const chatRow = (share: number): Row => {
  const percent = chatPercentUsed(share);
  return {
    id: "chat",
    label: "Chat, on us",
    count: `${percent}% used`,
    usedPercent: percent,
    ...(percent >= NEARLY_USED_UP ? { aside: "Nearly used up" } : {}),
  };
};

const savesRow = (used: number, limit: number): Row => ({
  id: "saves",
  label: "Saves without an overview",
  count: leftOf(Math.max(0, limit - used), limit),
  usedPercent: percentOf(used, limit),
});

interface UsageRowProps {
  row: Row;
}

const UsageRow = ({ row }: UsageRowProps) => (
  <div
    className={row.usedPercent >= NEARLY_USED_UP ? `${styles.row} ${styles.warning}` : styles.row}
    data-testid={planUsageTestIds.cell(row.id)}
  >
    <dt className={styles.label}>
      {row.label}
      {row.tally !== undefined && <span className={styles.tally}> · {row.tally}</span>}
    </dt>
    <dd className={styles.count}>{row.count}</dd>
    <dd className={styles.bar} aria-hidden="true">
      <b style={{ width: `${row.usedPercent}%` }} />
    </dd>
    {row.aside !== undefined && <dd className={styles.aside}>{row.aside}</dd>}
  </div>
);
