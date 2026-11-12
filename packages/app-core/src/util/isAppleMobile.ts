// iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
export const isAppleMobile = (): boolean =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
