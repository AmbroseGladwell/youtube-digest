// The hero's note and the dialog's are both in the document at once — the dialog's form is
// always mounted, closed — so two notes under one set of ids would be ambiguous. Each
// surface builds its own from its own prefix, the same reason the hero's field carries its
// own ids (docs/features/stone-theme.md, "The hero has its own field").
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
