// How long an unpaid booking holds its seats.
export const HOLD_SECONDS = 600;

export function isHoldExpired(createdAtIso, now, holdSeconds = HOLD_SECONDS) {
  return new Date(now).getTime() - new Date(createdAtIso).getTime() > holdSeconds * 1000;
}
