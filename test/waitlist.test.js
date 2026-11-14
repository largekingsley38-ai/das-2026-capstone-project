import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createFakeClock } from '../src/lib/clock.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createWaitlistService, OFFER_SECONDS } from '../src/services/waitlistService.js';
import { createMaintenance } from '../src/jobs/maintenance.js';
import { HOLD_SECONDS } from '../src/domain/holdPolicy.js';

async function setup(capacity = 1) {
  const repository = createMemoryRepository();
  const clock = createFakeClock('2026-12-01T10:00:00Z');
  const events = createEventService(repository);
  const waitlist = createWaitlistService(repository, clock);
  const bookings = createBookingService(repository, createMockPaymentGateway(), clock, undefined, (tierId) =>
    waitlist.offerFreedSeats(tierId),
  );
  const job = createMaintenance({ repository, clock, waitlist });
  const event = await events.createEvent('org1', {
    title: 'Show',
    city: 'Lagos',
    venue: 'Hall',
    startsAt: '2026-12-20T18:00:00Z',
  });
  const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity });
  await events.publishEvent('org1', event.id);

  const tierId = tier.id;
  const book = (user, quantity = 1) => bookings.bookTickets(user, { tierId, quantity });
  const join = (user, quantity = 1) => waitlist.joinWaitlist(user, { tierId, quantity });
  const sold = async () => (await repository.getTier(tierId)).sold;
  const status = async (entry) => (await repository.getWaitlistEntry(entry.id)).status;
  const pastOffer = () => clock.advanceMs((OFFER_SECONDS + 1) * 1000);
  const pastHold = () => clock.advanceMs((HOLD_SECONDS + 1) * 1000);
  return { bookings, waitlist, job, book, join, sold, status, pastOffer, pastHold };
}

test('joining a sold-out tier adds you at the end of the line', async () => {
  const s = await setup(1);
  await s.book('buyer1');
  const a = await s.join('A');
  const b = await s.join('B');
  assert.equal(a.position, 1);
  assert.equal(b.position, 2);
});

test('joining a tier that still has seats gives NOT_SOLD_OUT', async () => {
  const s = await setup(5);
  await assert.rejects(() => s.join('A'), { code: 'NOT_SOLD_OUT' });
});

test('joining twice gives ALREADY_ON_WAITLIST', async () => {
  const s = await setup(1);
  await s.book('buyer1');
  await s.join('A');
  await assert.rejects(() => s.join('A'), { code: 'ALREADY_ON_WAITLIST' });
});

test('a freed seat is offered to A first and held for A', async () => {
  const s = await setup(1);
  const held = await s.book('buyer1');
  const a = await s.join('A');
  const b = await s.join('B');
  const c = await s.join('C');
  await s.bookings.cancelBooking('buyer1', held.reference);
  assert.equal(await s.status(a), 'offered');
  assert.equal(await s.status(b), 'waiting');
  assert.equal(await s.status(c), 'waiting');
  assert.equal(await s.sold(), 1);
  await assert.rejects(() => s.book('stranger'), { code: 'SOLD_OUT' });
});

test('when A does not accept in time, the seat passes to B', async () => {
  const s = await setup(1);
  const held = await s.book('buyer1');
  const a = await s.join('A');
  const b = await s.join('B');
  const c = await s.join('C');
  await s.bookings.cancelBooking('buyer1', held.reference);
  s.pastOffer();
  assert.deepEqual(await s.waitlist.expireOffers(), { expired: 1 });
  assert.equal(await s.status(a), 'expired');
  assert.equal(await s.status(b), 'offered');
  assert.equal(await s.status(c), 'waiting');
  assert.equal(await s.sold(), 1);
});

test('accepting an expired offer gives OFFER_EXPIRED', async () => {
  const s = await setup(1);
  const held = await s.book('buyer1');
  const a = await s.join('A');
  const b = await s.join('B');
  await s.bookings.cancelBooking('buyer1', held.reference);
  s.pastOffer();
  await assert.rejects(() => s.waitlist.acceptOffer('A', a.id), { code: 'OFFER_EXPIRED' });
  assert.equal(await s.status(b), 'offered');
  assert.equal(await s.sold(), 1);
});

test('accepting in time makes a pending booking and keeps the seat', async () => {
  const s = await setup(1);
  const held = await s.book('buyer1');
  const a = await s.join('A');
  await s.bookings.cancelBooking('buyer1', held.reference);
  const booking = await s.waitlist.acceptOffer('A', a.id);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 1);
  assert.equal(await s.status(a), 'accepted');
  assert.equal(await s.sold(), 1);
});

test('the job offers seats freed by an expired unpaid booking', async () => {
  const s = await setup(1);
  await s.book('buyer1');
  const a = await s.join('A');
  s.pastHold();
  await s.job.run();
  assert.equal(await s.status(a), 'offered');
  assert.equal(await s.sold(), 1);
});