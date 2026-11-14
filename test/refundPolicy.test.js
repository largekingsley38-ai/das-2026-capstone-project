import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateRefund } from '../src/domain/refundPolicy.js';
import { createFakeClock } from '../src/lib/clock.js';

const START = '2026-12-20T18:00:00Z';
const HOUR = 60 * 60 * 1000;

function refundAt(hoursBefore, amountCents = 10000) {
  const clock = createFakeClock(START);
  clock.advanceMs(-hoursBefore * HOUR);
  return calculateRefund({ amountCents, startsAt: START, now: clock.now() });
}

test('exactly 7 days before gives 100%', () => {
  assert.deepEqual(refundAt(168), { refundCents: 10000, percent: 100 });
});

test('6 days 23 hours before gives 50%', () => {
  assert.deepEqual(refundAt(167), { refundCents: 5000, percent: 50 });
});

test('exactly 2 days before gives 50%', () => {
  assert.deepEqual(refundAt(48), { refundCents: 5000, percent: 50 });
});

test('1 day 23 hours before gives 0%', () => {
  assert.deepEqual(refundAt(47), { refundCents: 0, percent: 0 });
});

test('10 days, 3 days and 1 day match the user story', () => {
  assert.equal(refundAt(240).percent, 100);
  assert.equal(refundAt(72).percent, 50);
  assert.equal(refundAt(24).percent, 0);
});

test('odd cents are rounded down', () => {
  assert.equal(refundAt(72, 5001).refundCents, 2500);
});

test('an event that has started throws EVENT_STARTED', () => {
  assert.throws(() => refundAt(0), { code: 'EVENT_STARTED' });
  assert.throws(() => refundAt(-1), { code: 'EVENT_STARTED' });
});