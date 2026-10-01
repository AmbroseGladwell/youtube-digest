// For motion run from script, which theme/global.scss's reduced-motion rule cannot reach.
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
