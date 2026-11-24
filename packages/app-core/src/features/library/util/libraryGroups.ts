import { libraryEntryTitle, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { LibraryGroup, LibrarySort } from "../types/LibrarySort.js";
import { libraryEntryDate, NO_LIBRARY_ACTIVITY, type LibraryActivity } from "./libraryEntryDate.js";
import { libraryTitleKey } from "./libraryTitleKey.js";

export interface LibraryGroupRun<T extends LibraryEntry> {
  key: string;
  heading: string;
  entries: T[];
}

export interface LibraryGroupClock {
  now: Date;
  // 0 is Sunday, as Date.getDay counts.
  weekStartsOn: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NO_DATE: Omit<LibraryGroupRun<LibraryEntry>, "entries"> = { key: "none", heading: "No date" };

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date, weekStartsOn: number): Date => {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() - weekStartsOn + 7) % 7));
  return day;
};

const daysBetween = (later: Date, earlier: Date): number => Math.round((later.getTime() - earlier.getTime()) / 86_400_000);

const withYear = (text: string, date: Date, now: Date): string =>
  date.getFullYear() === now.getFullYear() ? text : `${text} ${date.getFullYear()}`;

const dayHeading = (date: Date, { now, weekStartsOn }: LibraryGroupClock): string => {
  const day = startOfDay(date);
  const today = startOfDay(now);
  const back = daysBetween(today, day);
  if (back === 0) {
    return "Today";
  }
  if (back === 1) {
    return "Yesterday";
  }
  if (back > 0 && day >= startOfWeek(now, weekStartsOn)) {
    return WEEKDAYS[day.getDay()]!;
  }
  return withYear(`${WEEKDAYS[day.getDay()]} ${day.getDate()} ${SHORT_MONTHS[day.getMonth()]}`, day, now);
};

const weekHeading = (date: Date, { now, weekStartsOn }: LibraryGroupClock): string => {
  const week = startOfWeek(date, weekStartsOn);
  const back = daysBetween(startOfWeek(now, weekStartsOn), week) / 7;
  if (back === 0) {
    return "This week";
  }
  if (back === 1) {
    return "Last week";
  }
  return withYear(`Week of ${week.getDate()} ${SHORT_MONTHS[week.getMonth()]}`, week, now);
};

const monthHeading = (date: Date, { now }: LibraryGroupClock): string => {
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return "This month";
  }
  return withYear(MONTHS[date.getMonth()]!, date, now);
};

const letterOf = (entry: LibraryEntry): Omit<LibraryGroupRun<LibraryEntry>, "entries"> => {
  const title = libraryEntryTitle(entry);
  if (title === null) {
    return { key: "untitled", heading: "No title" };
  }
  const first = libraryTitleKey(title).normalize("NFD").charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? { key: first, heading: first } : { key: "#", heading: "#" };
};

const HEADING: Record<Exclude<LibraryGroup, "none" | "letter">, (date: Date, clock: LibraryGroupClock) => string> = {
  day: dayHeading,
  week: weekHeading,
  month: monthHeading,
};

// Runs of an already ordered list under their headings; the device's clock, never a model's: docs/features/library-sort.md, "Group by".
export const libraryGroups = <T extends LibraryEntry>(
  ordered: T[],
  sort: LibrarySort,
  clock: LibraryGroupClock,
  activity: LibraryActivity = NO_LIBRARY_ACTIVITY,
): LibraryGroupRun<T>[] => {
  const { group, field } = sort;
  if (group === "none") {
    return [];
  }
  const groupOf = (entry: T): Omit<LibraryGroupRun<T>, "entries"> => {
    if (group === "letter" || field === "title") {
      return letterOf(entry);
    }
    const time = libraryEntryDate(entry, field, activity);
    if (time === null) {
      return NO_DATE;
    }
    const heading = HEADING[group](new Date(time), clock);
    return { key: heading, heading };
  };
  const runs: LibraryGroupRun<T>[] = [];
  for (const entry of ordered) {
    const { key, heading } = groupOf(entry);
    const last = runs.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      runs.push({ key, heading, entries: [entry] });
    }
  }
  return runs;
};

interface WeekInfoLocale extends Intl.Locale {
  weekInfo?: { firstDay: number };
  getWeekInfo?: () => { firstDay: number };
}

// Intl counts Monday 1 to Sunday 7; Monday where the browser can't say.
export const localeWeekStart = (locale: string = Intl.DateTimeFormat().resolvedOptions().locale): number => {
  try {
    const info = new Intl.Locale(locale) as WeekInfoLocale;
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? 1;
    return firstDay % 7;
  } catch {
    return 1;
  }
};
