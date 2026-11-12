export interface CookingTimerSource {
  action: number;
  time: number;
  seconds: number;
}

export interface CookingTimer {
  id: number;
  name: string | null;
  step: number;
  source: CookingTimerSource;
  range: boolean;
  totalMs: number;
  endsAt: number | null;
  leftMs: number | null;
  rangAt: number | null;
}

export interface CookingTimerStart {
  name: string | null;
  step: number;
  source: CookingTimerSource;
  range: boolean;
}

const MINUTE_MS = 60_000;

export const timeLeftMs = (timer: CookingTimer, now: number): number => {
  if (timer.rangAt !== null) return 0;
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  return timer.leftMs ?? 0;
};

export const isPaused = (timer: CookingTimer): boolean => timer.rangAt === null && timer.endsAt === null;

export const isRinging = (timer: CookingTimer): boolean => timer.rangAt !== null;

export function startedTimer(id: number, start: CookingTimerStart, now: number): CookingTimer {
  const totalMs = start.source.seconds * 1000;
  return { id, ...start, totalMs, endsAt: now + totalMs, leftMs: null, rangAt: null };
}

export const pausedTimer = (timer: CookingTimer, now: number): CookingTimer =>
  timer.endsAt === null ? timer : { ...timer, endsAt: null, leftMs: timeLeftMs(timer, now) };

export const resumedTimer = (timer: CookingTimer, now: number): CookingTimer =>
  timer.leftMs === null ? timer : { ...timer, endsAt: now + timer.leftMs, leftMs: null };

export function adjustedTimer(timer: CookingTimer, minutes: number, now: number): CookingTimer {
  const change = minutes * MINUTE_MS;
  if (timer.rangAt !== null) {
    return change > 0 ? { ...timer, totalMs: timer.totalMs + change, endsAt: now + change, leftMs: null, rangAt: null } : timer;
  }
  const left = timeLeftMs(timer, now) + change;
  const totalMs = Math.max(timer.totalMs + change, MINUTE_MS);
  if (left <= 0) return { ...timer, totalMs, endsAt: null, leftMs: null, rangAt: now };
  return timer.endsAt === null ? { ...timer, totalMs, leftMs: left } : { ...timer, totalMs, endsAt: now + left };
}

export const ranOut = (timers: readonly CookingTimer[], now: number): CookingTimer[] =>
  timers.map((timer) =>
    timer.rangAt === null && timer.endsAt !== null && timer.endsAt <= now ? { ...timer, endsAt: null, rangAt: timer.endsAt } : timer,
  );

export const soonestFirst = (timers: readonly CookingTimer[], now: number): CookingTimer[] =>
  timers.filter((timer) => !isRinging(timer)).sort((a, b) => timeLeftMs(a, now) - timeLeftMs(b, now) || a.id - b.id);

export const oldestRingingFirst = (timers: readonly CookingTimer[]): CookingTimer[] =>
  timers.filter(isRinging).sort((a, b) => a.rangAt! - b.rangAt! || a.id - b.id);

export const isSameSource = (a: CookingTimerSource, b: CookingTimerSource): boolean =>
  a.action === b.action && a.time === b.time && a.seconds === b.seconds;
