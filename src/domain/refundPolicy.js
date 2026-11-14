import { DomainError } from './errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// 7 days or more before the start: 100%. 2 days or more: 50%. Less: 0%.
// An exact boundary gets the better tier.
export function calculateRefund({ amountCents, startsAt, now }) {
  const start = new Date(startsAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(start) || Number.isNaN(current)) {
    throw new DomainError('VALIDATION', 'startsAt and now must be valid dates');
  }
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new DomainError('VALIDATION', 'amountCents must be a whole number');
  }
  if (current >= start) {
    throw new DomainError('EVENT_STARTED', 'This event has already started');
  }

  const untilStart = start - current;
  let percent = 0;
  if (untilStart >= 7 * DAY_MS) percent = 100;
  else if (untilStart >= 2 * DAY_MS) percent = 50;

  return { refundCents: Math.floor((amountCents * percent) / 100), percent };
}