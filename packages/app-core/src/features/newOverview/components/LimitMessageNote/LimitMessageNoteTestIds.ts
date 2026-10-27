// Built from each surface's own prefix, as the key prompt's are: the hero's and the
// dialog's are both in the document at once.
export const limitMessageNoteTestIds = (prefix: string) => ({
  root: `${prefix}.limitMessage.root`,
  title: `${prefix}.limitMessage.title`,
  body: `${prefix}.limitMessage.body`,
  action: (action: string) => `${prefix}.limitMessage.action.${action}`,
  foot: `${prefix}.limitMessage.foot`,
});

export type LimitMessageNoteTestIds = ReturnType<typeof limitMessageNoteTestIds>;
