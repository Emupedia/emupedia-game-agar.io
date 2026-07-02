type SetIntervalFn = (handler: TimerHandler, timeout?: number, ...args: unknown[]) => number;

const nativeSetInterval = window.setInterval.bind(window) as SetIntervalFn;

interface TrackedInterval {
  clear: (id: number) => void;
  id: number;
}

const tracked: TrackedInterval[] = [];
let purge = false;

export function agxInterval(fn: () => void, ms: number): number {
  return nativeSetInterval(fn, ms);
}

export function trackIntervalsOf(w: Window & typeof globalThis) {
  const nativeSet = w.setInterval.bind(w) as SetIntervalFn;
  const nativeClear = w.clearInterval.bind(w);
  const wrapped: SetIntervalFn = (handler, timeout, ...args) => {
    const id = nativeSet(handler, timeout, ...args);
    if (purge) nativeClear(id);
    else tracked.push({ clear: nativeClear, id });
    return id;
  };
  try {
    w.setInterval = wrapped as typeof w.setInterval;
  } catch {}
}

export function killGameIntervals(): number {
  purge = true;
  const n = tracked.length;
  for (const t of tracked) {
    try { t.clear(t.id); } catch {}
  }
  tracked.length = 0;
  return n;
}
