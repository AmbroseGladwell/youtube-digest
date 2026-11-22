export const planUsageTestIds = {
  root: "PlanUsage.root",
  period: "PlanUsage.period",
  cell: (quota: "ours" | "own" | "transcribing") => `PlanUsage.cell.${quota}`,
  chatMeter: "PlanUsage.chatMeter",
  chatPercent: "PlanUsage.chatPercent",
  addKeyLink: "PlanUsage.addKeyLink",
  createAccountLink: "PlanUsage.createAccountLink",
};
