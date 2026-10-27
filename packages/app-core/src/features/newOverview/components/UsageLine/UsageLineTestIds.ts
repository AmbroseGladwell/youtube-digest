// The hero's line and the dialog's are both in the document at once, as the key prompt's
// are, so each surface builds its own from its own prefix.
export const usageLineTestIds = (prefix: string) => ({
  root: `${prefix}.usageLine.root`,
  planLink: `${prefix}.usageLine.planLink`,
});

export type UsageLineTestIds = ReturnType<typeof usageLineTestIds>;
