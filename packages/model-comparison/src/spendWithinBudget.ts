export interface Spend {
  costDollars: number | null;
}

export interface BudgetedSpend<R extends Spend> {
  lanes: readonly (readonly (() => Promise<R>)[])[];
  budgetDollars: number;
  spentDollars: number;
  save: (result: R) => Promise<void>;
  describe: (result: R, spentDollars: number) => string;
  log: (line: string) => void;
}

export interface SpendOutcome {
  ran: number;
  spentDollars: number;
  stoppedForBudget: boolean;
}

// One task at a time per lane, so the budget is overshot by at most one task per lane.
export const spendWithinBudget = async <R extends Spend>(options: BudgetedSpend<R>): Promise<SpendOutcome> => {
  let spentDollars = options.spentDollars;
  let stoppedForBudget = false;
  let ran = 0;

  const work = async (lane: readonly (() => Promise<R>)[]) => {
    for (const task of lane) {
      if (spentDollars >= options.budgetDollars) {
        stoppedForBudget = true;
        return;
      }
      const result = await task();
      spentDollars += result.costDollars ?? 0;
      ran += 1;
      await options.save(result);
      options.log(options.describe(result, spentDollars));
    }
  };

  await Promise.all(options.lanes.map(work));
  return { ran, spentDollars, stoppedForBudget };
};

export const totalSpent = (results: readonly Spend[]): number => results.reduce((total, result) => total + (result.costDollars ?? 0), 0);
