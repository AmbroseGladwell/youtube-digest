import { promptTokensOf } from "@overview/generation";
import type { ChatConversationRecord, ChatTurnRecord } from "./runChatConversation.js";

export const READER_MONTHS = { light: 15, typical: 60, heavy: 300 } as const;
const LONG_MS = 60 * 60_000;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? 0
    : sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const share = (turns: readonly ChatTurnRecord[], pick: (turn: ChatTurnRecord) => boolean | null | undefined): string => {
  const counted = turns.map(pick).filter((value): value is boolean => value !== null && value !== undefined);
  return counted.length === 0 ? "—" : `${counted.filter(Boolean).length}/${counted.length}`;
};
const dollars = (value: number) => (value >= 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(5)}`);

interface Arm {
  label: string;
  records: ChatConversationRecord[];
}

const groupBy = (records: readonly ChatConversationRecord[]): Arm[] => {
  const groups = new Map<string, ChatConversationRecord[]>();
  for (const record of records) {
    const label = `${record.model} · ${record.arm}`;
    groups.set(label, [...(groups.get(label) ?? []), record]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, grouped]) => ({ label, records: grouped }));
};

const answered = (records: readonly ChatConversationRecord[]) =>
  records.flatMap((record) => record.turns.filter((turn) => turn.error === null));
const perMessage = (turns: readonly ChatTurnRecord[], cost: (turn: ChatTurnRecord) => number) => mean(turns.map(cost));
const cachedCost = (turn: ChatTurnRecord) => turn.costDollars + turn.queryEmbeddingDollars;
const uncachedCost = (turn: ChatTurnRecord) => turn.uncachedCostDollars + turn.queryEmbeddingDollars;

export const chatReportMarkdown = (records: readonly ChatConversationRecord[]): string => {
  const arms = groupBy(records);
  const lines: string[] = [];
  const ranOn = [...new Set(records.map((record) => record.ranOn))].sort().join(", ");
  const pricesOn = [...new Set(records.map((record) => record.pricesCheckedOn))].sort().join(", ");
  const first = records[0];
  lines.push(
    `Ran ${ranOn}; prices checked ${pricesOn}; ${records.length} conversations; passages of ${first?.windowS ?? "?"} s, ${first?.retrieveCount ?? "?"} retrieved per question.`,
    "",
    "## Cost per message",
    "",
    "| Model · shape | Prompt tokens (median) | Of which cached | Output tokens (median) | Per message, cached | Per message, no caching | Under an hour | Over an hour | Latency (median) |",
    "|---|---|---|---|---|---|---|---|---|",
  );
  for (const arm of arms) {
    const turns = answered(arm.records);
    const short = answered(arm.records.filter((record) => record.videoMs < LONG_MS));
    const long = answered(arm.records.filter((record) => record.videoMs >= LONG_MS));
    const cachedShare =
      turns.reduce((sum, turn) => sum + turn.usage.cachedInputTokens, 0) /
      Math.max(
        turns.reduce((sum, turn) => sum + promptTokensOf(turn.usage), 0),
        1,
      );
    lines.push(
      `| ${arm.label} | ${Math.round(median(turns.map((turn) => promptTokensOf(turn.usage))))} | ${Math.round(cachedShare * 100)}% | ${Math.round(median(turns.map((turn) => turn.usage.outputTokens)))} | ${dollars(perMessage(turns, cachedCost))} | ${dollars(perMessage(turns, uncachedCost))} | ${dollars(perMessage(short, cachedCost))} | ${dollars(perMessage(long, cachedCost))} | ${(median(turns.map((turn) => turn.latencyMs)) / 1000).toFixed(1)} s |`,
    );
  }

  lines.push(
    "",
    "## Per reader-month, cached, at the set's mix of lengths",
    "",
    `| Model · shape | Light (${READER_MONTHS.light}) | Typical (${READER_MONTHS.typical}) | Heavy (${READER_MONTHS.heavy}) | Heavy, all over an hour |`,
    "|---|---|---|---|---|",
  );
  for (const arm of arms) {
    const each = perMessage(answered(arm.records), cachedCost);
    const longEach = perMessage(answered(arm.records.filter((record) => record.videoMs >= LONG_MS)), cachedCost);
    lines.push(
      `| ${arm.label} | ${dollars(each * READER_MONTHS.light)} | ${dollars(each * READER_MONTHS.typical)} | ${dollars(each * READER_MONTHS.heavy)} | ${dollars(longEach * READER_MONTHS.heavy)} |`,
    );
  }

  lines.push(
    "",
    "## Quality",
    "",
    "| Model · shape | Answered or declined rightly | Declined what the video doesn't say | Cited the right moment | inOverview | transcriptOnly | twoMoments | Named the expected detail | Cited a passage it wasn't given | Errors |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const arm of arms) {
    const turns = answered(arm.records);
    const all = arm.records.flatMap((record) => record.turns);
    const ofKind = (kind: string) =>
      share(
        turns.filter((turn) => turn.kind === kind),
        (turn) => turn.score?.citedRightMoment,
      );
    lines.push(
      `| ${arm.label} | ${share(turns, (turn) => turn.score?.rightOnSource)} | ${share(
        turns.filter((turn) => turn.kind === "notInSource"),
        (turn) => turn.score?.rightOnSource,
      )} | ${share(turns, (turn) => turn.score?.citedRightMoment)} | ${ofKind("inOverview")} | ${ofKind("transcriptOnly")} | ${ofKind("twoMoments")} | ${share(turns, (turn) => turn.score?.mentioned)} | ${share(turns, (turn) => turn.score?.citedUnknownPassage)} | ${all.length - turns.length} |`,
    );
  }
  return `${lines.join("\n")}\n`;
};
