import type { ListenPick } from "./ListenPick.js";

const minutes = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export const listenMarkdown = (picks: readonly ListenPick[], name: string, oldRun: string, newRun: string): string => {
  const count = (preferred: ListenPick["preferred"]) => picks.filter((pick) => pick.preferred === preferred).length;
  const rows = picks.map(
    (pick) =>
      `| ${cell(pick.title)} | ${minutes(pick.oldSeconds)} | ${minutes(pick.newSeconds)} | ${pick.preferred} | ${cell(pick.reason) || "—"} |`,
  );
  return [
    `# Blind listen: ${name}`,
    "",
    `Old: \`${oldRun}\`. New: \`${newRun}\`. Spoken lengths are the rendered audio's own.`,
    "",
    `**New ${count("new")}, old ${count("old")}, about the same ${count("tie")}**, of ${picks.length} pairs.`,
    "",
    "| Source | Old, spoken | New, spoken | Preferred | Why |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
};
