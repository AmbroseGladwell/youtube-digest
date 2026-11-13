const sameDay = (left: Date, right: Date): boolean => left.toDateString() === right.toDateString();

export const projectShortDate = (iso: string, now: Date): string =>
  sameDay(new Date(iso), now) ? "today" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));

export const projectLongDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(iso));
