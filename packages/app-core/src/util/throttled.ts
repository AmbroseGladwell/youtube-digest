export interface Throttled {
  call: () => void;
  flush: () => void;
  cancel: () => void;
}

// Runs at once, then at most once per interval: calls in between run together at its end.
export const throttled = (run: () => void, intervalMs: number): Throttled => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let waiting = false;
  const intervalEnds = () => {
    if (!waiting) {
      timer = null;
      return;
    }
    waiting = false;
    run();
    timer = setTimeout(intervalEnds, intervalMs);
  };
  return {
    call: () => {
      if (timer !== null) {
        waiting = true;
        return;
      }
      run();
      timer = setTimeout(intervalEnds, intervalMs);
    },
    flush: () => {
      if (!waiting || timer === null) {
        return;
      }
      clearTimeout(timer);
      waiting = false;
      run();
      timer = setTimeout(intervalEnds, intervalMs);
    },
    cancel: () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = null;
      waiting = false;
    },
  };
};
