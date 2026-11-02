import { DomainError } from './errors.js';

// The booking life cycle, written as data.
// Each state lists the states it is allowed to move to.
export const BOOKING_STATES = ['pending', 'paid', 'cancelled', 'refunded', 'checked_in'];

const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['checked_in', 'refunded', 'cancelled'],
  // Final states: nothing leaves them.
  cancelled: [],
  refunded: [],
  checked_in: [],
};

export function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DomainError('INVALID_TRANSITION', `A booking cannot move from ${from} to ${to}`, { from, to });
  }
}