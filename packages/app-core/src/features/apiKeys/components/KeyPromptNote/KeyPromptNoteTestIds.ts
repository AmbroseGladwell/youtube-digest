// Prefixed per surface, as hero and dialog share a page: docs/features/stone-theme.md, "What was built".
export const keyPromptNoteTestIds = (prefix: string) => ({
  root: `${prefix}.keyPrompt.root`,
  heading: `${prefix}.keyPrompt.heading`,
  detail: `${prefix}.keyPrompt.detail`,
  settingsLink: `${prefix}.keyPrompt.settingsLink`,
  addKey: `${prefix}.keyPrompt.addKey`,
  useFallback: `${prefix}.keyPrompt.useFallback`,
  footnote: `${prefix}.keyPrompt.footnote`,
});

export type KeyPromptNoteTestIds = ReturnType<typeof keyPromptNoteTestIds>;
