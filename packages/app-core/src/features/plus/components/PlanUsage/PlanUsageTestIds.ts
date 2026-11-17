export const planUsageTestIds = {
  root: "PlanUsage.root",
  period: "PlanUsage.period",
  cell: (quota: "ours" | "own" | "trial" | "transcribing") => `PlanUsage.cell.${quota}`,
  addKeyLink: "PlanUsage.addKeyLink",
  createAccountLink: "PlanUsage.createAccountLink",
};
