export type UsageRowId = "ours" | "own" | "transcribing" | "chat" | "saves";

export const planUsageTestIds = {
  root: "PlanUsage.root",
  period: "PlanUsage.period",
  cell: (row: UsageRowId) => `PlanUsage.cell.${row}`,
  addKeyLink: "PlanUsage.addKeyLink",
  createAccountLink: "PlanUsage.createAccountLink",
};
