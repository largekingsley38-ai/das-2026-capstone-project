import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createFakeClock } from '../src/lib/clock.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';

const STARTS = '2026-12-20T18:00:00Z';

async function setup(nowIso) {
  const repository = createMemoryRepository();
  const gateway = createMockPaymentGateway();
  const clock = createFakeClock(nowIso);
  const events = createEventService(repository);
  const bookings = createBookingService(repository, gateway, clock);
  const event = await events.createEvent('org1', {
    title: 'Show',
    city: 'Lagos',
    venue: 'Hall',
    startsAt: STARTS,
  });
  const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity: 10 });
  await events.publishEvent('org1', event.id);

  async function book(quantity) {
    return bookings.bookTickets('buyer1', { tierId: tier.id, quantity });
  }
  async function paid(quantity = 2) {
    const booking = await book(quantity);
    return bookings.payBooking('buyer1', booking.reference);
  }
  const sold = async () => (await repository.getTier(tier.id)).sold;
  return { bookings, gateway, clock, book, paid, sold };
}

test('10 days away: 100% refunded and seats released', async () => {
  const s = await setup('2026-12-10T18:00:00Z');
  const booking = await s.paid(2);
  assert.equal(await s.sold(), 2);
  const result = await s.bookings.cancelBooking('buyer1', booking.reference);
  assert.equal(result.status, 'refunded');
  assert.equal(result.refund.refundCents, 10000);
  assert.equal(await s.sold(), 0);
  assert.equal(s.gateway.refundCount(), 1);
});

test('3 days away: 50% refunded', async () => {
  const s = await setup('2026-12-17T18:00:00Z');
  const booking = await s.paid(2);
  const result = await s.bookings.cancelBooking('buyer1', booking.reference);
  assert.equal(result.refund.refundCents, 5000);
  assert.equal(result.refund.percent, 50);
});

test('1 day away: nothing refunded, seats still released', async () => {
  const s = await setup('2026-12-19T18:00:00Z');
  const booking = await s.paid(2);
  const result = await s.bookings.cancelBooking('buyer1', booking.reference);
  assert.equal(result.status, 'refunded');
  assert.equal(result.refund.refundCents, 0);
  assert.equal(s.gateway.refundCount(), 0);
  assert.equal(await s.sold(), 0);
});

test('cancelling twice is rejected and seats are not released twice', async () => {
  const s = await setup('2026-12-10T18:00:00Z');
  const first = await s.paid(2);
  await s.book(3); // someone else holds 3 seats
  await s.bookings.cancelBooking('buyer1', first.reference);
  assert.equal(await s.sold(), 3);
  await assert.rejects(() => s.bookings.cancelBooking('buyer1', first.reference), {
    code: 'INVALID_TRANSITION',
  });
  assert.equal(await s.sold(), 3);
  assert.equal(s.gateway.refundCount(), 1);
});

test('cancelling a pending booking releases the seats', async () => {
  const s = await setup('2026-12-10T18:00:00Z');
  const booking = await s.book(4);
  assert.equal(await s.sold(), 4);
  const result = await s.bookings.cancelBooking('buyer1', booking.reference);
  assert.equal(result.status, 'cancelled');
  assert.equal(await s.sold(), 0);
});

test('after the event has started, a paid booking cannot be cancelled', async () => {
  const s = await setup('2026-12-10T18:00:00Z');
  const booking = await s.paid(2);
  s.clock.set('2026-12-20T19:00:00Z');
  await assert.rejects(() => s.bookings.cancelBooking('buyer1', booking.reference), {
    code: 'EVENT_STARTED',
  });
  assert.equal(await s.sold(), 2);
});