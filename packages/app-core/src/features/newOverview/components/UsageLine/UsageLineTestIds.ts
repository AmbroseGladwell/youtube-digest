// Prefixed per surface: the hero's and the dialog's are both in the document at once.
export const usageLineTestIds = (prefix: string) => ({
  root: `${prefix}.usageLine.root`,
  planLink: `${prefix}.usageLine.planLink`,
});

export type UsageLineTestIds = ReturnType<typeof usageLineTestIds>;
