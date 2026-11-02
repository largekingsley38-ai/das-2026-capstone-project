import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKING_STATES,
  canTransition,
  assertTransition,
} from '../src/domain/bookingStateMachine.js';

const ALLOWED = [
  ['pending', 'paid'],
  ['pending', 'cancelled'],
  ['paid', 'checked_in'],
  ['paid', 'refunded'],
  ['paid', 'cancelled'],
];

test('every allowed booking move is allowed', () => {
  for (const [from, to] of ALLOWED) {
    assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
    assert.doesNotThrow(() => assertTransition(from, to));
  }
});

test('every other booking move is refused with INVALID_TRANSITION', () => {
  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      const isAllowed = ALLOWED.some(([a, b]) => a === from && b === to);
      if (isAllowed) continue;
      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
      assert.throws(() => assertTransition(from, to), { code: 'INVALID_TRANSITION' });
    }
  }
});

test('paying a cancelled booking is refused', () => {
  assert.throws(() => assertTransition('cancelled', 'paid'), { code: 'INVALID_TRANSITION' });
});

test('final states have no way out', () => {
  for (const from of ['cancelled', 'refunded', 'checked_in']) {
    for (const to of BOOKING_STATES) {
      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
    }
  }
});

test('an unknown state is refused, not a crash', () => {
  assert.equal(canTransition('banana', 'paid'), false);
  assert.throws(() => assertTransition('pending', 'banana'), { code: 'INVALID_TRANSITION' });
});