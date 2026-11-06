import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

// 50 people try to buy the ONE last seat at the same moment.
async function runRace(repository) {
  const events = createEventService(repository);
  const bookings = createBookingService(repository, createMockPaymentGateway());

  const event = await events.createEvent('org1', {
    title: 'Last Seat Show',
    city: 'Lagos',
    startsAt: '2026-12-05T18:00:00Z',
  });
  const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity: 1 });
  await events.publishEvent('org1', event.id);

  const attempts = Array.from({ length: 50 }, (_, i) =>
    bookings.bookTickets(`user${i}`, { tierId: tier.id, quantity: 1 }).then(
      () => 'ok',
      (error) => error.code ?? error.message,
    ),
  );
  const results = await Promise.all(attempts);
  const finalTier = await repository.getTier(tier.id);
  return { results, finalTier };
}

function check({ results, finalTier }) {
  assert.equal(results.filter((r) => r === 'ok').length, 1);
  assert.equal(results.filter((r) => r === 'SOLD_OUT').length, 49);
  assert.equal(finalTier.sold, 1);
}

test('oversell: 50 bookings for 1 seat on SQLite = 1 success, 49 SOLD_OUT', async () => {
  const db = openDatabase(':memory:');
  check(await runRace(createSqliteRepository(db)));
});

test('oversell: 50 bookings for 1 seat in memory = 1 success, 49 SOLD_OUT', async () => {
  check(await runRace(createMemoryRepository()));
});