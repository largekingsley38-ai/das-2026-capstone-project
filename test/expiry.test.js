import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createFakeClock } from '../src/lib/clock.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMaintenance } from '../src/jobs/maintenance.js';
import { HOLD_SECONDS } from '../src/domain/holdPolicy.js';

async function setup() {
  const repository = createMemoryRepository();
  const clock = createFakeClock('2026-12-01T10:00:00Z');
  const events = createEventService(repository);
  const bookings = createBookingService(repository, createMockPaymentGateway(), clock);
  const job = createMaintenance({ repository, clock });
  const event = await events.createEvent('org1', {
    title: 'Show',
    city: 'Lagos',
    venue: 'Hall',
    startsAt: '2026-12-20T18:00:00Z',
  });
  const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity: 10 });
  await events.publishEvent('org1', event.id);

  const book = (quantity) => bookings.bookTickets('buyer1', { tierId: tier.id, quantity });
  const sold = async () => (await repository.getTier(tier.id)).sold;
  const pastHold = () => clock.advanceMs((HOLD_SECONDS + 1) * 1000);
  return { bookings, job, book, sold, pastHold };
}

test('a pending booking older than the hold is cancelled and seats released once', async () => {
  const s = await setup();
  await s.book(3);
  assert.equal(await s.sold(), 3);
  s.pastHold();
  assert.deepEqual(await s.job.expireUnpaidBookings(), { expired: 1 });
  assert.equal(await s.sold(), 0);
  assert.deepEqual(await s.job.expireUnpaidBookings(), { expired: 0 });
  assert.equal(await s.sold(), 0);
});

test('a pending booking inside the hold time is left alone', async () => {
  const s = await setup();
  await s.book(3);
  assert.deepEqual(await s.job.expireUnpaidBookings(), { expired: 0 });
  assert.equal(await s.sold(), 3);
});

test('a paid booking is not touched by the job', async () => {
  const s = await setup();
  const booking = await s.book(2);
  await s.bookings.payBooking('buyer1', booking.reference);
  s.pastHold();
  assert.deepEqual(await s.job.expireUnpaidBookings(), { expired: 0 });
  assert.equal(await s.sold(), 2);
});

test('paying an expired booking gives BOOKING_EXPIRED', async () => {
  const s = await setup();
  const booking = await s.book(2);
  s.pastHold();
  await s.job.expireUnpaidBookings();
  await assert.rejects(() => s.bookings.payBooking('buyer1', booking.reference), {
    code: 'BOOKING_EXPIRED',
  });
  assert.equal(await s.sold(), 0);
});

test('paying late, before the job runs, is also BOOKING_EXPIRED and frees seats once', async () => {
  const s = await setup();
  const booking = await s.book(2);
  s.pastHold();
  await assert.rejects(() => s.bookings.payBooking('buyer1', booking.reference), {
    code: 'BOOKING_EXPIRED',
  });
  assert.equal(await s.sold(), 0);
  assert.deepEqual(await s.job.expireUnpaidBookings(), { expired: 0 });
  assert.equal(await s.sold(), 0);
});