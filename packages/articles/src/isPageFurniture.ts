const PAGE_FURNITURE =
  'nav, footer, aside, form, [hidden], [aria-hidden="true"], [role="navigation"], [role="complementary"], [role="contentinfo"], #comments, .comments, .comments-area, .comment, .comment-body, .comment-content';

export const isPageFurniture = (element: Element): boolean => element.closest(PAGE_FURNITURE) !== null;
