// The code asks this clock for the time, so tests can control "now".

export function createClock() {
  return { now: () => new Date() };
}

// For tests: a clock you can set and move forward.
export function createFakeClock(startIso) {
  let current = new Date(startIso).getTime();
  return {
    now: () => new Date(current),
    set(iso) {
      current = new Date(iso).getTime();
    },
    advanceMs(ms) {
      current += ms;
    },
  };
}